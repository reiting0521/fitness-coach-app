
/** Normalize performed set rows for lift + mobility shapes (backward compatible). */
export function normalizePerformed(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((p) => {
    const durationSec = p?.durationSec != null ? Number(p.durationSec) : null
    const hasDuration = durationSec != null && !Number.isNaN(durationSec)
    return {
      weightKg: hasDuration ? null : (p?.weightKg != null ? Number(p.weightKg) : null),
      reps: hasDuration ? null : (p?.reps != null ? Number(p.reps) : null),
      durationSec: hasDuration ? durationSec : null,
    }
  })
}

const SETTINGS_KEY = 'fc_settings'
const LOG_PREFIX = 'fc_log_'
const PLAN_KEY = 'fc_plan'
const DRAFT_PREFIX = 'fc_draft_'
const SEED_FLAG = 'fc_seed_v2_2026_09_16'

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
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw),
      folderIds: { ...DEFAULT_SETTINGS.folderIds, ...(JSON.parse(raw).folderIds || {}) },
    }
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
    const log = raw ? JSON.parse(raw) : null
    if (!log) return null
    if (Array.isArray(log.exercises)) {
      log.exercises = log.exercises.map((ex) => ({
        ...ex,
        performed: normalizePerformed(ex.performed),
      }))
    }
    return log
  } catch {
    return null
  }
}

export function saveLog(dateStr, log) {
  localStorage.setItem(LOG_PREFIX + dateStr, JSON.stringify(log))
}

export function listLockedLogs() {
  const out = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(LOG_PREFIX)) continue
      const log = JSON.parse(localStorage.getItem(k))
      if (log?.completed) {
        out.push(log)
      }
    }
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function loadDraft(dateStr) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + dateStr)
    const draft = raw ? JSON.parse(raw) : null
    if (!draft) return null
    if (Array.isArray(draft.exercises)) {
      draft.exercises = draft.exercises.map((ex) => ({
        ...ex,
        performed: normalizePerformed(ex.performed),
      }))
    }
    return draft
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

export function ensureSeedLog(seedLog) {
  if (!seedLog?.date) return false
  const flag = localStorage.getItem(SEED_FLAG)
  const existing = loadLog(seedLog.date)
  if (existing?.completed && flag) return false
  // Seed if missing or incomplete; don't overwrite a user-finished richer log with fewer sets
  if (!existing?.completed) {
    saveLog(seedLog.date, { ...seedLog, locked: true, completed: true })
    localStorage.setItem(SEED_FLAG, '1')
    return true
  }
  if (!flag) localStorage.setItem(SEED_FLAG, '1')
  return false
}

/** Prefer bundled seed plan when local cache is older version */
export function mergePlanPreferNewer(local, seed) {
  if (!local) return seed
  if (!seed) return local
  const lv = Number(local.planVersion || 0)
  const sv = Number(seed.planVersion || 0)
  if (sv > lv) return seed
  // Equal version but local lost mobility metadata → prefer seed (fixes kg×reps on Thu)
  if (sv === lv) {
    const thu = local.week?.thursday
    const missing =
      thu &&
      /mobility|stretch|recovery/i.test(String(thu.focus || '')) &&
      (thu.exercises || []).some((ex) => ex.kind !== 'mobility' && ex.durationSec == null)
    if (missing) return seed
  }
  return local
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
