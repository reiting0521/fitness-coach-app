/**
 * Google Identity Services + Drive API v3 helpers.
 * Persists access token across reloads so Connect is not required every visit.
 */

const SCOPES = 'https://www.googleapis.com/auth/drive'
const TOKEN_KEY = 'fc_drive_token_v1'

let tokenClient = null
let accessToken = null
let expiresAt = 0
let gisReady = false
let gapiReady = false

export function getClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
}

export function isConfigured() {
  return Boolean(getClientId())
}

export function getAccessToken() {
  return accessToken
}

export function isSignedIn() {
  return Boolean(accessToken) && Date.now() < expiresAt
}

function loadStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.accessToken || !data?.expiresAt) return null
    if (Date.now() >= data.expiresAt) {
      localStorage.removeItem(TOKEN_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function persistToken(token, expiresInSec) {
  const skewMs = 60_000
  const ttl = Number(expiresInSec) > 0 ? Number(expiresInSec) : 3600
  expiresAt = Date.now() + ttl * 1000 - skewMs
  accessToken = token
  try {
    localStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ accessToken: token, expiresAt }),
    )
  } catch {
    /* private mode */
  }
}

function clearStoredToken() {
  accessToken = null
  expiresAt = 0
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

export async function initGoogle() {
  if (!isConfigured()) return { ok: false, reason: 'no_client_id' }

  await loadScript('https://accounts.google.com/gsi/client')

  // eslint-disable-next-line no-undef
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: getClientId(),
    scope: SCOPES,
    callback: () => {},
  })
  gisReady = true
  gapiReady = true

  const stored = loadStoredToken()
  if (stored) {
    accessToken = stored.accessToken
    expiresAt = stored.expiresAt
  }

  return { ok: true, restored: Boolean(stored) }
}

function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      reject(new Error('Set VITE_GOOGLE_CLIENT_ID to enable Google Drive sync.'))
      return
    }
    if (!tokenClient) {
      reject(new Error('Google Identity Services not initialized yet.'))
      return
    }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error))
        return
      }
      persistToken(resp.access_token, resp.expires_in)
      resolve({ accessToken })
    }
    tokenClient.requestAccessToken({ prompt })
  })
}

/** Interactive connect — prefer silent if we already have a live session elsewhere. */
export function signIn() {
  return ensureSignedIn({ allowConsent: true })
}

/**
 * Restore or refresh token without forcing consent on every open.
 * 1) valid stored token → return
 * 2) silent requestAccessToken({ prompt: '' })
 * 3) only if that fails and allowConsent → prompt:'consent' once
 */
export async function ensureSignedIn({ allowConsent = true } = {}) {
  if (isSignedIn()) return { accessToken }

  const stored = loadStoredToken()
  if (stored) {
    accessToken = stored.accessToken
    expiresAt = stored.expiresAt
    if (isSignedIn()) return { accessToken }
  }

  try {
    return await requestToken('')
  } catch (silentErr) {
    if (!allowConsent) throw silentErr
    return requestToken('consent')
  }
}

export function signOut() {
  const token = accessToken
  if (token && window.google?.accounts?.oauth2) {
    try {
      google.accounts.oauth2.revoke(token, () => {})
    } catch {
      /* ignore */
    }
  }
  clearStoredToken()
}

async function driveGet(path, params = {}) {
  await ensureSignedIn({ allowConsent: false }).catch(() => {})
  if (!accessToken) throw new Error('Not signed in')
  const qs = new URLSearchParams(params).toString()
  const url = `https://www.googleapis.com/drive/v3${path}${qs ? `?${qs}` : ''}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive GET ${path}: ${res.status} ${text}`)
  }
  return res.json()
}

async function driveDownload(fileId) {
  await ensureSignedIn({ allowConsent: false }).catch(() => {})
  if (!accessToken) throw new Error('Not signed in')
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive download: ${res.status} ${text}`)
  }
  return res.text()
}

async function findChildByName(parentId, name, mimeType) {
  let q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and trashed = false`
  if (mimeType) q += ` and mimeType = '${mimeType}'`
  const data = await driveGet('/files', {
    q,
    fields: 'files(id,name,mimeType)',
    spaces: 'drive',
    pageSize: '5',
  })
  return data.files?.[0] || null
}

async function createFolder(parentId, name) {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })
  if (!res.ok) throw new Error(`Create folder failed: ${res.status}`)
  return res.json()
}

async function uploadOrUpdateJson(parentId, name, json, existingId) {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const metadata = { name, mimeType: 'application/json' }
  if (!existingId) metadata.parents = [parentId]

  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  )
  form.append('file', blob)

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed: ${res.status} ${text}`)
  }
  return res.json()
}

/**
 * Resolve Fitness Coach + logs folders using known ids, else find/create by name.
 */
export async function resolveFolders(settings) {
  const ids = { ...settings.folderIds }
  try {
    if (ids.fitnessCoach) {
      await driveGet(`/files/${ids.fitnessCoach}`, { fields: 'id,name' })
    }
  } catch {
    ids.fitnessCoach = null
  }
  try {
    if (ids.logs) {
      await driveGet(`/files/${ids.logs}`, { fields: 'id,name' })
    }
  } catch {
    ids.logs = null
  }

  if (!ids.fitnessCoach) {
    const data = await driveGet('/files', {
      q: "name = 'Fitness Coach' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id,name)',
      spaces: 'drive',
      pageSize: '5',
    })
    if (data.files?.[0]) {
      ids.fitnessCoach = data.files[0].id
    } else {
      const created = await createFolder('root', 'Fitness Coach')
      ids.fitnessCoach = created.id
    }
  }

  if (!ids.logs) {
    const found = await findChildByName(ids.fitnessCoach, 'logs', 'application/vnd.google-apps.folder')
    if (found) {
      ids.logs = found.id
    } else {
      const created = await createFolder(ids.fitnessCoach, 'logs')
      ids.logs = created.id
    }
  }

  return ids
}

export async function fetchPlanFromDrive(settings) {
  await ensureSignedIn({ allowConsent: false })
  if (!accessToken) throw new Error('Not signed in')
  const ids = await resolveFolders(settings)

  const v2 = await findChildByName(ids.fitnessCoach, 'plan-v2.json', 'application/json')
  if (v2) {
    ids.plan = v2.id
    const text = await driveDownload(v2.id)
    return { plan: JSON.parse(text), folderIds: ids, planFile: 'plan-v2.json' }
  }

  let planId = ids.plan
  try {
    if (planId) {
      const text = await driveDownload(planId)
      return { plan: JSON.parse(text), folderIds: ids, planFile: 'plan.json' }
    }
  } catch {
    planId = null
  }
  const found = await findChildByName(ids.fitnessCoach, 'plan.json', 'application/json')
  if (!found) throw new Error('plan-v2.json / plan.json not found in Fitness Coach folder')
  ids.plan = found.id
  const text = await driveDownload(found.id)
  return { plan: JSON.parse(text), folderIds: ids, planFile: 'plan.json' }
}

export async function saveLogToDrive(settings, dateStr, log) {
  await ensureSignedIn({ allowConsent: false })
  if (!accessToken) throw new Error('Not signed in')
  const ids = await resolveFolders(settings)
  const name = `${dateStr}.json`
  const existing = await findChildByName(ids.logs, name, 'application/json')
  const file = await uploadOrUpdateJson(ids.logs, name, log, existing?.id || null)
  return { file, folderIds: ids }
}

export { SCOPES }
