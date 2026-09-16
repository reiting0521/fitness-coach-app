/** Lightweight CSS/SVG form diagrams — no external GIFs. */

const DIAGRAMS = {
  squat: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><rect x="34" y="8" width="12" height="10" rx="3" fill="currentColor" opacity=".9"/><path d="M40 18v18M40 36l-12 18M40 36l12 18M28 54l-6 12M52 54l6 12M28 22h24" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="40" cy="14" r="5" fill="currentColor"/></svg>`,
  press: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><circle cx="40" cy="18" r="5" fill="currentColor"/><path d="M40 23v22M28 32h24M34 45l-8 18M46 45l8 18M20 12h40" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  bench: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><path d="M12 48h56M18 48V36h44v12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="40" cy="28" r="5" fill="currentColor"/><path d="M20 22h40M28 34h24" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  hinge: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><circle cx="48" cy="16" r="5" fill="currentColor"/><path d="M48 21l-10 16M38 37l-14 8M38 37l8 20M24 45h-8M20 68h24" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  row: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><circle cx="28" cy="20" r="5" fill="currentColor"/><path d="M28 25l14 10M42 35l10-4M42 35l6 18M22 48h36" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M52 28h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  fly: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><circle cx="40" cy="22" r="5" fill="currentColor"/><path d="M40 27v20M28 36c-10 0-14 8-14 8M52 36c10 0 14 8 14 8M32 47l-6 16M48 47l6 16" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  hip: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><path d="M10 50h28v8H10z" fill="currentColor" opacity=".35"/><circle cx="52" cy="28" r="5" fill="currentColor"/><path d="M52 33v10M38 48h28M42 48l-4 16M62 48l4 16M30 42h20" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  abduct: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><circle cx="40" cy="18" r="5" fill="currentColor"/><path d="M40 23v20M40 43l-18 8M40 43l18 8M22 51l-8 12M58 51l8 12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M18 40h14M48 40h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".7"/></svg>`,
  adduct: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><circle cx="40" cy="18" r="5" fill="currentColor"/><path d="M40 23v20M34 43l-6 20M46 43l6 20" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M22 40h12M46 40h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".7"/></svg>`,
  calf: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><circle cx="40" cy="14" r="5" fill="currentColor"/><path d="M40 19v28M40 47l-4 10M40 47l6 8M30 68h24M36 57h8" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M28 62h8" stroke="currentColor" stroke-width="2" opacity=".5"/></svg>`,
  pull: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><path d="M20 12h40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="36" r="5" fill="currentColor"/><path d="M28 14l4 18M52 14l-4 18M40 41v10M34 51l-6 14M46 51l6 14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  raise: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><circle cx="40" cy="22" r="5" fill="currentColor"/><path d="M40 27v22M28 34l-14-6M52 34l14-6M34 49l-6 16M46 49l6 16" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  default: `<svg viewBox="0 0 80 80" class="ex-svg" aria-hidden="true"><circle cx="40" cy="18" r="5" fill="currentColor"/><path d="M40 23v24M28 34h24M34 47l-8 18M46 47l8 18" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
}

const KEYWORDS = [
  [/squat/i, 'squat'],
  [/hip thrust|glute bridge|pull-through/i, 'hip'],
  [/abduct/i, 'abduct'],
  [/adduct|copenhagen/i, 'adduct'],
  [/calf/i, 'calf'],
  [/bench|dip|push-up|fly|crossover|pec/i, 'bench'],
  [/overhead|shoulder press|landmine|lateral raise|shrug/i, 'press'],
  [/deadlift|rdl|romanian|hinge|rack pull/i, 'hinge'],
  [/row|face pull|rear-delt|pull-apart/i, 'row'],
  [/pull-up|pulldown|pullover|straight-arm/i, 'pull'],
  [/raise|fly/i, 'raise'],
]

export function diagramFor(name) {
  const key = KEYWORDS.find(([re]) => re.test(name || ''))?.[1] || 'default'
  return DIAGRAMS[key] || DIAGRAMS.default
}

export function formatRest(sec) {
  if (!sec) return ''
  if (sec >= 60) {
    const m = Math.round(sec / 60)
    return `~${m} min rest`
  }
  return `${sec}s rest`
}
