/**
 * Google Identity Services + Drive API v3 helpers.
 * Access tokens stay in module memory only (never localStorage).
 * Scope: drive.file (files created/opened by this app).
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.file'
/** Legacy key — cleared on init so old broad-scope tokens are not reused. */
const LEGACY_TOKEN_KEY = 'fc_drive_token_v1'

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

/** Wipe any previously persisted token (XSS / shared-device risk). */
function clearLegacyStoredToken() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(LEGACY_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

function setMemoryToken(token, expiresInSec) {
  const skewMs = 60_000
  const ttl = Number(expiresInSec) > 0 ? Number(expiresInSec) : 3600
  expiresAt = Date.now() + ttl * 1000 - skewMs
  accessToken = token
}

function clearMemoryToken() {
  accessToken = null
  expiresAt = 0
}

/**
 * Safe Drive error: status + short phrase only (no response body / Google JSON).
 */
function driveError(action, status) {
  const code = Number(status) || 0
  let phrase = 'request failed'
  if (code === 401) phrase = 'unauthorized'
  else if (code === 403) phrase = 'forbidden'
  else if (code === 404) phrase = 'not found'
  else if (code === 429) phrase = 'rate limited'
  else if (code >= 500) phrase = 'server error'
  return new Error(`Drive ${action}: ${code || 'error'} (${phrase})`)
}

function safeAuthError(code) {
  const c = String(code || 'auth_error')
  // GIS codes are short tokens; never forward arbitrary strings
  const known = new Set([
    'access_denied',
    'popup_closed',
    'popup_failed_to_open',
    'immediate_failed',
    'invalid_request',
    'opt_out_or_no_session',
  ])
  const safe = known.has(c) ? c : 'auth_error'
  return new Error(`Google sign-in failed (${safe})`)
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
    s.onerror = () => reject(new Error('Failed to load Google Identity script'))
    document.head.appendChild(s)
  })
}

export async function initGoogle() {
  if (!isConfigured()) return { ok: false, reason: 'no_client_id' }

  clearLegacyStoredToken()

  await loadScript('https://accounts.google.com/gsi/client')

  // eslint-disable-next-line no-undef
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: getClientId(),
    scope: SCOPES,
    callback: () => {},
  })
  gisReady = true
  gapiReady = true

  return { ok: true, restored: false }
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
        reject(safeAuthError(resp.error))
        return
      }
      setMemoryToken(resp.access_token, resp.expires_in)
      resolve({ accessToken })
    }
    tokenClient.requestAccessToken({ prompt })
  })
}

/** Interactive connect — consent if silent restore is unavailable. */
export function signIn() {
  return ensureSignedIn({ allowConsent: true })
}

/**
 * Keep / refresh token in memory without forcing consent on every open.
 * 1) valid in-memory token → return
 * 2) silent requestAccessToken({ prompt: '' })
 * 3) only if that fails and allowConsent → prompt:'consent' once
 */
export async function ensureSignedIn({ allowConsent = true } = {}) {
  if (isSignedIn()) return { accessToken }

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
  clearMemoryToken()
  clearLegacyStoredToken()
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
    // Drain body without exposing it
    await res.text().catch(() => '')
    throw driveError(`GET ${path}`, res.status)
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
    await res.text().catch(() => '')
    throw driveError('download', res.status)
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
  if (!res.ok) {
    await res.text().catch(() => '')
    throw driveError('create folder', res.status)
  }
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
    await res.text().catch(() => '')
    throw driveError('upload', res.status)
  }
  return res.json()
}

/**
 * Resolve Fitness Coach + logs folders.
 * Under drive.file, list/search only returns files this app created or opened.
 * Prefer cached IDs; else find among app-visible files; else create.
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
