/** Resolve How-to demo media: ExerciseDB real GIFs first (never VA SVG as hero). */
import mapping from './demos/mapping.json'
import realMapping from './demos/real-mapping.json'

const BASE = import.meta.env.BASE_URL || '/'

/** Plan id aliases → mapping ids */
const ID_ALIASES = {
  'face-pull': 'face-pull-fri',
}

const WED_FRI_PRIMARY_IDS = [
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

function mediaPath(entry) {
  if (!entry) return null
  return entry.file || entry.gif || entry.gifUrl || entry.loop || entry.real || null
}

function realEntry(id) {
  const rid = resolveId(id)
  const fromReal = realMapping?.exercises?.[rid] || realMapping?.exercises?.[id]
  const path = mediaPath(fromReal)
  if (fromReal && path) {
    const local =
      path.includes('real/') || !/^https?:/i.test(path)
        ? path.startsWith('real/') || path.startsWith('demos/')
          ? path.replace(/^demos\//, '')
          : path.includes('/')
            ? path
            : `real/${path}`
        : null
    const loopPath = local || (fromReal.file || fromReal.gif) || null
    return {
      id: rid || id,
      name: fromReal.name,
      real: loopPath || fromReal.gifUrl || path,
      loop: loopPath || fromReal.gifUrl || path,
      gifUrl: fromReal.gifUrl || null,
      cdnUrl: fromReal.gifUrl || ( /^https?:/i.test(path) ? path : null),
      source: 'exercisedb',
      exerciseId: fromReal.exerciseId || fromReal.exercisedbId,
      equipment: (fromReal.equipments || [])[0],
      preferGif: true,
      matchNote: fromReal.matchNote || fromReal.note || null,
      placeholder: false,
    }
  }
  // Convention: public/demos/real/{id}.gif shipped even without mapping row
  if (rid && WED_FRI_PRIMARY_IDS.includes(rid)) {
    return {
      id: rid,
      real: `real/${rid}.gif`,
      loop: `real/${rid}.gif`,
      source: 'exercisedb',
      preferGif: true,
      placeholder: false,
    }
  }
  return null
}

function byId(id) {
  if (!id) return null
  const mapped = resolveId(id)
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

/** Tight name → demo id rules (current name only — never original after swap). */
const TIGHT_NAME_RULES = [
  [/^barbell (back )?squat$|^back squat$/, 'back-squat'],
  [/^goblet squat$/, 'goblet-squat'],
  [/^leg press$/, 'leg-press'],
  [/^hack squat$/, 'hack-squat'],
  [/^(barbell )?hip thrust$/, 'hip-thrust'],
  [/^dumbbell hip thrust$/, 'dumbbell-hip-thrust'],
  [/^cable pull.?through$/, 'cable-pull-through'],
  [/^glute bridge/, 'glute-bridge'],
  [/abductor machine|hip abductor/, 'hip-abductor'],
  [/adductor machine|hip adductor/, 'hip-adductor'],
  [/^cable hip abduction|^band.*hip abduction/, 'cable-hip-abduction'],
  [/^band side walk|^monster walk|^band lateral walk/, 'band-lateral-walk'],
  [/^cable (hip )?adduction$/, 'cable-adduction'],
  [/^side.?lying adductor/, 'side-lying-adductor'],
  [/single.?leg calf|smith.*calf/, 'smith-sl-calf'],
  [/^standing dumbbell calf|^dumbbell standing calf/, 'standing-db-calf'],
  [/^seated calf/, 'seated-calf'],
  [/^leg.?press calf/, 'leg-press-calf'],
  [/^deadlift|trap.?bar deadlift/, 'deadlift'],
  [/^heavy barbell row|^barbell (bent over )?row$|^pendlay row$/, 'barbell-row'],
  [/^romanian deadlift|^rdl$/, 'rdl'],
  [/^rack pull$/, 'rack-pull'],
  [/^pull.?up or lat pulldown|^lat pulldown|^pull.?up$/, 'pulldown'],
  [/^assisted pull.?up|^assisted chin/, 'assisted-pull-up'],
  [/^neutral.?grip pulldown/, 'neutral-pulldown'],
  [/seal row|chest.?supported.*row/, 'seal-row'],
  [/^one.?arm dumbbell row|^dumbbell one arm.*row/, 'one-arm-db-row'],
  [/^cable seated row|^seated cable row/, 'seated-cable-row'],
  [/straight.?arm pulldown/, 'straight-arm-pd'],
  [/^dumbbell pullover$/, 'db-pullover'],
  [/^single.?arm cable row/, 'single-arm-cable-row'],
  [/^face pull$/, 'face-pull-fri'],
  [/^band pull.?apart|^band reverse fly/, 'band-reverse-fly'],
  [/^reverse pec.?deck/, 'reverse-pec-deck'],
]

function tightNameMatch(name) {
  const n = normalizeName(name)
  if (!n) return null
  for (const [re, id] of TIGHT_NAME_RULES) {
    if (re.test(n)) {
      const d = byId(id)
      if (d) return d
    }
  }
  // Exact name match against real mapping entries only (no fuzzy includes)
  for (const [id, entry] of Object.entries(realMapping.exercises || {})) {
    const dn = normalizeName(entry.name)
    const display = normalizeName(entry.exercisedbName || '')
    if (dn && (n === dn || n === display)) {
      return byId(id)
    }
  }
  return null
}

/**
 * Match plan exercise → demo entry (real GIF preferred).
 * Priority:
 * 1. ex.demoId / ex.id (current, post-swap)
 * 2. Tight name match for current ex.name only (never originalName for media)
 * 3. CDN gifUrl from mapping if local missing (handled by consumer via demo.gifUrl)
 * 4. null → placeholder (never fall back to previous exercise GIF)
 */
export function getDemoForExercise(ex) {
  if (!ex) return null

  const demoKey = ex.demoId || ex.id
  if (demoKey) {
    const hit = byId(demoKey)
    if (hit) return hit
  }

  // After a swap, never resolve media via original id/name — only current name
  const nameHit = tightNameMatch(ex.name)
  if (nameHit) return nameHit

  // If we have a demoId/id mapped with CDN only
  if (demoKey) {
    const raw = realMapping?.exercises?.[resolveId(demoKey)] || realMapping?.exercises?.[demoKey]
    if (raw?.gifUrl) {
      return {
        id: demoKey,
        name: raw.name,
        real: raw.gifUrl,
        loop: raw.gifUrl,
        gifUrl: raw.gifUrl,
        source: 'exercisedb',
        preferGif: true,
        matchNote: raw.matchNote || raw.note || null,
        placeholder: false,
      }
    }
  }

  return null
}

export function hasRealDemo(demo) {
  if (!demo) return false
  const path = demo.real || demo.loop || demo.gif || demo.realGif || demo.gifUrl
  if (!path) return false
  if (/^https?:/i.test(path)) return true
  return Boolean(String(path).includes('real/') && !String(path).endsWith('.svg'))
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

export function slugifyExerciseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
