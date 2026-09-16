/** Resolve How-to demo media from mapping + public/demos (Iron Quiet §8). */
import mapping from './demos/mapping.json'

const BASE = import.meta.env.BASE_URL || '/'

export function demoAssetUrl(rel) {
  if (!rel) return null
  if (/^https?:/i.test(rel)) return rel
  return `${BASE}demos/${String(rel).replace(/^demos\//, '')}`
}

export function getDemoForExercise(ex) {
  const id = ex?.id || null
  if (id && mapping.exercises?.[id]) return mapping.exercises[id]
  const name = (ex?.name || '').toLowerCase()
  for (const d of Object.values(mapping.exercises || {})) {
    if (d.name && name.includes(d.name.toLowerCase().slice(0, 10))) return d
  }
  return null
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
