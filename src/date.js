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

/** Mon→Sun order for week strip UI */
const WEEK_STRIP_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const SHORT_LABELS = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

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

/** Parse YYYY-MM-DD as noon UTC to avoid DST edge issues when formatting in TZ */
export function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

export function addDays(dateStr, delta) {
  const dt = parseDateStr(dateStr)
  dt.setUTCDate(dt.getUTCDate() + delta)
  return getZurichDateString(dt)
}

/** Monday (YYYY-MM-DD) of the week containing dateStr, Europe/Zurich */
export function getWeekMonday(dateStr) {
  const key = getZurichWeekdayKey(parseDateStr(dateStr))
  const idx = WEEK_STRIP_KEYS.indexOf(key) // 0=Mon … 6=Sun
  return addDays(dateStr, -idx)
}

export function getWeekDays(dateStr) {
  const monday = getWeekMonday(dateStr)
  return WEEK_STRIP_KEYS.map((key, i) => {
    const date = addDays(monday, i)
    return {
      key,
      date,
      short: SHORT_LABELS[key],
      dayNum: Number(date.slice(-2)),
    }
  })
}

export function displayDateFor(dateStr) {
  return getZurichDisplayDate(parseDateStr(dateStr))
}

export function weekdayKeyFor(dateStr) {
  return getZurichWeekdayKey(parseDateStr(dateStr))
}

/** Next training (non-rest) day after dateStr within the plan week cycle */
export function nextTrainingDay(plan, fromDateStr) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(fromDateStr, i)
    const key = weekdayKeyFor(d)
    const day = plan.week?.[key]
    if (day && !day.rest) {
      return { date: d, key, day }
    }
  }
  return null
}

export { TZ, WEEKDAY_KEYS, WEEK_STRIP_KEYS, SHORT_LABELS }
