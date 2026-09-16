/**
 * Google Identity Services + Drive API v3 helpers.
 * Works without a client ID (calls no-op / throw friendly errors).
 */

const SCOPES = 'https://www.googleapis.com/auth/drive'
let tokenClient = null
let accessToken = null
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
  return Boolean(accessToken)
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
  return { ok: true }
}

export function signIn() {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      reject(new Error('Set VITE_GOOGLE_CLIENT_ID to enable Google Drive sync.'))
      return
    }
    if (!tokenClient) {
      reject(new Error('Google Identity Services not initialized yet.'))
      return
    }
    tokenClient.callback = async (resp) => {
      if (resp.error) {
        reject(new Error(resp.error))
        return
      }
      accessToken = resp.access_token
      resolve({ accessToken })
    }
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' })
  })
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(accessToken, () => {})
  }
  accessToken = null
}

async function driveGet(path, params = {}) {
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
  // Verify known ids; if fail, fall back to search under My Drive root
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
    // Search by name
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
  if (!accessToken) throw new Error('Not signed in')
  const ids = await resolveFolders(settings)
  let planId = ids.plan
  try {
    if (planId) {
      const text = await driveDownload(planId)
      return { plan: JSON.parse(text), folderIds: ids }
    }
  } catch {
    planId = null
  }
  const found = await findChildByName(ids.fitnessCoach, 'plan.json', 'application/json')
  if (!found) throw new Error('plan.json not found in Fitness Coach folder')
  ids.plan = found.id
  const text = await driveDownload(found.id)
  return { plan: JSON.parse(text), folderIds: ids }
}

export async function saveLogToDrive(settings, dateStr, log) {
  if (!accessToken) throw new Error('Not signed in')
  const ids = await resolveFolders(settings)
  const name = `${dateStr}.json`
  const existing = await findChildByName(ids.logs, name, 'application/json')
  const file = await uploadOrUpdateJson(ids.logs, name, log, existing?.id || null)
  return { file, folderIds: ids }
}

export { SCOPES }
