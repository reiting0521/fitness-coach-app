/** Resolve How-to demo media: ExerciseDB real GIFs first (never VA SVG as hero). */
import mapping from './demos/mapping.json'
import realMapping from './demos/real-mapping.json'

const BASE = import.meta.env.BASE_URL || '/'

/** Plan id aliases → mapping ids */
const ID_ALIASES = {
  'face-pull': 'face-pull-fri',
}

const WED_FRI_IDS = [
  'back-squat',
  'hip-thrust',
  'hip-abductor',
  'hip-adductor',
  'smith-sl-calf',
  'deadlift',
  'pulldown',
  'seal-row',
  'straight-arm-pd',
  'face-pull-fri',
]

export function demoAssetUrl(rel) {
  if (!rel) return null
  if (/^https?:/i.test(rel)) return rel
  return `${BASE}demos/${String(rel).replace(/^demos\//, '')}`
}

function resolveId(id) {
  if (!id) return null
  return ID_ALIASES[id] || id
}

function realEntry(id) {
  const rid = resolveId(id)
  const fromReal = realMapping?.exercises?.[rid] || realMapping?.exercises?.[id]
  if (fromReal?.file) {
    return {
      id: rid,
      name: fromReal.name,
      real: fromReal.file,
      loop: fromReal.file,
      source: 'exercisedb',
      exerciseId: fromReal.exerciseId,
      equipment: (fromReal.equipments || [])[0],
      preferGif: true,
    }
  }
  // Convention: public/demos/real/{id}.gif shipped even without mapping row
  if (rid && WED_FRI_IDS.includes(rid)) {
    return {
      id: rid,
      real: `real/${rid}.gif`,
      loop: `real/${rid}.gif`,
      source: 'exercisedb',
      preferGif: true,
    }
  }
  return null
}

function byId(id) {
  if (!id) return null
  const mapped = resolveId(id)
  // Real ExerciseDB always wins over VA mapping
  const real = realEntry(mapped) || realEntry(id)
  if (real) return real
  return mapping.exercises?.[mapped] || mapping.exercises?.[id] || null
}

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Match plan exercise → demo entry (real GIF preferred). */
export function getDemoForExercise(ex) {
  const hit = byId(ex?.id)
  if (hit) return hit

  const name = normalizeName(ex?.name || ex?.originalName)
  if (!name) return null

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

  // Name match against bundled mapping (may still upgrade to real/)
  for (const d of Object.values(mapping.exercises || {})) {
    const dn = normalizeName(d.name)
    if (!dn) continue
    if (name === dn || name.includes(dn) || dn.includes(name)) {
      const real = realEntry(d.id)
      return real || d
    }
  }
  return null
}

export function hasRealDemo(demo) {
  if (!demo) return false
  const path = demo.real || demo.loop || demo.gif || demo.realGif
  return Boolean(path && String(path).includes('real/') && !String(path).endsWith('.svg'))
}

export function hasVaDemo(demo) {
  if (!demo) return false
  if (demo.sequence) return true
  return (demo.frames || []).some(
    (f) => String(f.file || '').includes('/va/') || String(f.file || '').endsWith('.svg'),
  )
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
