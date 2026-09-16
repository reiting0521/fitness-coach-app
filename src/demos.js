/** Resolve How-to demo media from mapping + public/demos (Iron Quiet §8 / VA). */
import mapping from './demos/mapping.json'

const BASE = import.meta.env.BASE_URL || '/'

/** Plan id aliases → Visual Artist mapping ids */
const ID_ALIASES = {
  'face-pull': 'face-pull-fri',
}

export function demoAssetUrl(rel) {
  if (!rel) return null
  if (/^https?:/i.test(rel)) return rel
  return `${BASE}demos/${String(rel).replace(/^demos\//, '')}`
}

function byId(id) {
  if (!id) return null
  const mapped = ID_ALIASES[id] || id
  return mapping.exercises?.[mapped] || mapping.exercises?.[id] || null
}

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Match plan exercise names (Wed Legs + Fri Back) to VA mapping entries. */
export function getDemoForExercise(ex) {
  const hit = byId(ex?.id)
  if (hit) return hit

  const name = normalizeName(ex?.name || ex?.originalName)
  if (!name) return null

  const entries = Object.values(mapping.exercises || {})

  // Exact / contains mapped name
  for (const d of entries) {
    const dn = normalizeName(d.name)
    if (!dn) continue
    if (name === dn || name.includes(dn) || dn.includes(name)) return d
  }

  // Keyword heuristics for common plan wording
  const rules = [
    [/back squat|barbell squat/, 'back-squat'],
    [/hip thrust/, 'hip-thrust'],
    [/abductor/, 'hip-abductor'],
    [/adductor/, 'hip-adductor'],
    [/calf/, 'smith-sl-calf'],
    [/deadlift|trap.?bar/, 'deadlift'],
    [/pull.?up|lat pulldown|pulldown/, 'pulldown'],
    [/seal row|chest.?supported/, 'seal-row'],
    [/straight.?arm/, 'straight-arm-pd'],
    [/face pull/, 'face-pull-fri'],
  ]
  for (const [re, id] of rules) {
    if (re.test(name)) {
      const d = byId(id)
      if (d) return d
    }
  }
  return null
}

/** Whether this demo entry has Visual Artist media (sequence or VA frames). */
export function hasVaDemo(demo) {
  if (!demo) return false
  if (demo.sequence) return true
  return (demo.frames || []).some((f) => String(f.file || '').includes('/va/') || String(f.file || '').endsWith('.svg'))
}

export function normalizeCues(cues) {
  if (!cues) return { setup: [], move: [], avoid: [] }
  if (Array.isArray(cues)) {
    return { setup: [], move: cues.filter(Boolean), avoid: [] }
  }
  return {
    setup: cues.setup || cues.Setup || [],
    move: cues.move || cues.Move || cues.execution || [],
    avoid: cues.avoid || cues.Avoid || [],
  }
}
