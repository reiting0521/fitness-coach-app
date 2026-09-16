const SETTINGS_KEY = 'fc_settings'
const LOG_PREFIX = 'fc_log_'
const PLAN_KEY = 'fc_plan'
const DRAFT_PREFIX = 'fc_draft_'

const DEFAULT_SETTINGS = {
  unit: 'kg',
  driveConnected: false,
  googleEmail: null,
  folderIds: {
    fitnessCoach: '1GCzaDOcj-jHmbMCxh7YEVDb8AqQNJ-c-',
    logs: '1W4Wwho9JYB0bCvGUsbuwAhwgtoF04IBO',
    plan: '1okdWjmCZkGAKnigHh2qF8rackLGzurUX',
  },
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, folderIds: { ...DEFAULT_SETTINGS.folderIds } }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw), folderIds: { ...DEFAULT_SETTINGS.folderIds, ...(JSON.parse(raw).folderIds || {}) } }
  } catch {
    return { ...DEFAULT_SETTINGS, folderIds: { ...DEFAULT_SETTINGS.folderIds } }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadPlanLocal() {
  try {
    const raw = localStorage.getItem(PLAN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function savePlanLocal(plan) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan))
}

export function loadLog(dateStr) {
  try {
    const raw = localStorage.getItem(LOG_PREFIX + dateStr)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveLog(dateStr, log) {
  localStorage.setItem(LOG_PREFIX + dateStr, JSON.stringify(log))
}

export function loadDraft(dateStr) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + dateStr)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveDraft(dateStr, draft) {
  localStorage.setItem(DRAFT_PREFIX + dateStr, JSON.stringify(draft))
}

export function clearDraft(dateStr) {
  localStorage.removeItem(DRAFT_PREFIX + dateStr)
}

export function kgToLb(kg) {
  return Math.round(kg * 2.2046226218 * 10) / 10
}

export function lbToKg(lb) {
  return Math.round((lb / 2.2046226218) * 100) / 100
}

export function displayWeight(kg, unit) {
  if (kg == null || kg === '') return ''
  const n = Number(kg)
  if (Number.isNaN(n)) return ''
  return unit === 'lb' ? kgToLb(n) : n
}

export function inputWeightToKg(value, unit) {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return unit === 'lb' ? lbToKg(n) : n
}
