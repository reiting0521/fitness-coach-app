/** Iron Quiet stroke icons — Design Director / Icon Master (24×24, currentColor). */

import ico_calf_raise from './icons/calf-raise.svg?raw'
import ico_check from './icons/check.svg?raw'
import ico_check_circle from './icons/check-circle.svg?raw'
import ico_chevron_down from './icons/chevron-down.svg?raw'
import ico_chevron_left from './icons/chevron-left.svg?raw'
import ico_chevron_right from './icons/chevron-right.svg?raw'
import ico_close from './icons/close.svg?raw'
import ico_cloud_off from './icons/cloud-off.svg?raw'
import ico_cloud_sync from './icons/cloud-sync.svg?raw'
import ico_cues from './icons/cues.svg?raw'
import ico_deadlift from './icons/deadlift.svg?raw'
import ico_face_pull from './icons/face-pull.svg?raw'
import ico_hip_thrust from './icons/hip-thrust.svg?raw'
import ico_lat_pulldown from './icons/lat-pulldown.svg?raw'
import ico_leg_curl from './icons/leg-curl.svg?raw'
import ico_leg_press from './icons/leg-press.svg?raw'
import ico_lock from './icons/lock.svg?raw'
import ico_lunge from './icons/lunge.svg?raw'
import ico_more from './icons/more.svg?raw'
import ico_nav_log from './icons/nav-log.svg?raw'
import ico_nav_settings from './icons/nav-settings.svg?raw'
import ico_nav_today from './icons/nav-today.svg?raw'
import ico_pull_up from './icons/pull-up.svg?raw'
import ico_rdl from './icons/rdl.svg?raw'
import ico_rest from './icons/rest.svg?raw'
import ico_row from './icons/row.svg?raw'
import ico_shrug from './icons/shrug.svg?raw'
import ico_squat from './icons/squat.svg?raw'
import ico_swap from './icons/swap.svg?raw'
import ico_unlock from './icons/unlock.svg?raw'
import ico_warning from './icons/warning.svg?raw'

const RAW = {
  'calf-raise': ico_calf_raise,
  'check': ico_check,
  'check-circle': ico_check_circle,
  'chevron-down': ico_chevron_down,
  'chevron-left': ico_chevron_left,
  'chevron-right': ico_chevron_right,
  'close': ico_close,
  'cloud-off': ico_cloud_off,
  'cloud-sync': ico_cloud_sync,
  'cues': ico_cues,
  'deadlift': ico_deadlift,
  'face-pull': ico_face_pull,
  'hip-thrust': ico_hip_thrust,
  'lat-pulldown': ico_lat_pulldown,
  'leg-curl': ico_leg_curl,
  'leg-press': ico_leg_press,
  'lock': ico_lock,
  'lunge': ico_lunge,
  'more': ico_more,
  'nav-log': ico_nav_log,
  'nav-settings': ico_nav_settings,
  'nav-today': ico_nav_today,
  'pull-up': ico_pull_up,
  'rdl': ico_rdl,
  'rest': ico_rest,
  'row': ico_row,
  'shrug': ico_shrug,
  'squat': ico_squat,
  'swap': ico_swap,
  'unlock': ico_unlock,
  'warning': ico_warning,
}

function prep(svg, className = 'ico') {
  if (!svg) return ''
  return svg
    .replace(/\s(width|height)="24"/g, '')
    .replace('<svg ', `<svg class="${className}" aria-hidden="true" `)
    .trim()
}

export function icon(name, className = 'ico') {
  const key = name in RAW ? name : null
  return prep(key ? RAW[key] : RAW['more'], className)
}

export const ICONS = Object.fromEntries(
  Object.keys(RAW).map((k) => [k, () => icon(k)])
)

/** Map exercise display name → icon id */
const KEYWORDS = [
  [/face\s*pull/i, 'face-pull'],
  [/shrug/i, 'shrug'],
  [/hip\s*thrust|glute\s*bridge|pull-through/i, 'hip-thrust'],
  [/calf/i, 'calf-raise'],
  [/leg\s*curl|lying\s*curl|seated\s*curl/i, 'leg-curl'],
  [/leg\s*press|hack\s*squat/i, 'leg-press'],
  [/lunge|split\s*squat|step[- ]?up/i, 'lunge'],
  [/goblet\s*squat|back\s*squat|front\s*squat|squat/i, 'squat'],
  [/romanian|\brdl\b/i, 'rdl'],
  [/deadlift|rack\s*pull|trap[- ]?bar/i, 'deadlift'],
  [/pull[- ]?up|chin[- ]?up/i, 'pull-up'],
  [/lat\s*pulldown|pulldown|straight-arm/i, 'lat-pulldown'],
  [/row|seal\s*row/i, 'row'],
  [/abduct|adduct|clam/i, 'hip-thrust'],
]

export function iconForExercise(name, className = 'ex-svg') {
  const key = KEYWORDS.find(([re]) => re.test(name || ''))?.[1] || 'row'
  return icon(key, className)
}

export function formatRest(sec) {
  if (!sec) return ''
  if (sec >= 60) {
    const m = Math.round(sec / 60)
    return `~${m} min rest`
  }
  return `${sec}s rest`
}
