const TZ = 'Europe/Zurich'

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

export function getZurichNow(date = new Date()) {
  return date
}

/** YYYY-MM-DD in Europe/Zurich */
export function getZurichDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function getZurichWeekdayKey(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
  })
    .format(date)
    .toLowerCase()
  return weekday
}

export function getZurichDisplayDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function getZurichIsoNow() {
  // Prefer explicit offset for Zurich when possible
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const get = (type) => parts.find((p) => p.type === type)?.value
  const offsetRaw = get('timeZoneName') || 'GMT+02:00'
  const offset = offsetRaw.replace('GMT', '') || '+02:00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`
}

export { TZ, WEEKDAY_KEYS }
