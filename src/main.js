import './style.css'
import seedPlan from './plan.json'
import seedLog from './seed-log-2026-09-16.json'
import { diagramFor, formatRest, icon } from './diagrams.js'
import { getDemoForExercise, demoAssetUrl, normalizeCues } from './demos.js'
import {
  getZurichDateString,
  getZurichDisplayDate,
  getZurichIsoNow,
  displayDateFor,
  weekdayKeyFor,
  getWeekDays,
  addDays,
  nextTrainingDay,
  SHORT_LABELS,
  TZ,
} from './date.js'
import {
  loadSettings,
  saveSettings,
  loadPlanLocal,
  savePlanLocal,
  loadLog,
  saveLog,
  loadDraft,
  saveDraft,
  clearDraft,
  listLockedLogs,
  ensureSeedLog,
  mergePlanPreferNewer,
  displayWeight,
  inputWeightToKg,
} from './storage.js'
import * as drive from './drive.js'

const FEELINGS = [
  { id: 'easy', label: 'Easy' },
  { id: 'solid', label: 'Solid' },
  { id: 'grind', label: 'Grind' },
]

let settings = loadSettings()
let plan = mergePlanPreferNewer(loadPlanLocal(), seedPlan)
let view = 'today' // today | settings
let selectedDate = getZurichDateString()
let session = null
let toastTimer = null
let sheetEl = null


const app = document.querySelector('#app')


/** Escape untrusted plan/Drive/user strings before innerHTML. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeErrMsg(err) {
  const msg = err && typeof err.message === 'string' ? err.message : 'Something went wrong'
  // Only surface short, already-sanitized app errors
  return msg.length > 120 ? 'Something went wrong' : msg
}

function toast(msg) {
  let el = document.querySelector('.toast')
  if (!el) {
    el = document.createElement('div')
    el.className = 'toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800)
}

function planDayFor(dateStr) {
  const key = weekdayKeyFor(dateStr)
  return plan.week?.[key] || { focus: 'Rest', rest: true, exercises: [] }
}

function emptyPerformed(sets) {
  return Array.from({ length: Math.max(1, sets || 1) }, () => ({
    weightKg: null,
    reps: null,
  }))
}

function findPlanExercise(day, name) {
  return (day.exercises || []).find((e) => e.name === name) || null
}

function buildSessionFromPlan(day, dateStr) {
  const existingLog = loadLog(dateStr)
  if (existingLog?.completed) {
    return {
      date: dateStr,
      fromLog: true,
      completed: true,
      locked: true,
      overallFeeling: existingLog.overallFeeling || null,
      sessionNote: existingLog.sessionNote || '',
      dayFocus: existingLog.dayFocus || day.focus,
      rest: !!existingLog.rest || (!existingLog.exercises?.length && !!day.rest),
      exercises: (existingLog.exercises || []).map((ex) => {
        const planEx = findPlanExercise(day, ex.originalName || ex.name)
        return {
          id: planEx?.id || ex.id || null,
          name: ex.name,
          originalName: ex.originalName || ex.name,
          planned: {
            sets: ex.planned?.sets ?? planEx?.sets ?? 1,
            reps: ex.planned?.reps ?? planEx?.reps ?? '',
            note: ex.planned?.note || planEx?.note || '',
            restSec: ex.planned?.restSec ?? planEx?.restSec ?? null,
            optional: !!ex.planned?.optional || !!ex.optional || !!planEx?.optional,
          },
          cues: ex.cues || planEx?.cues || [],
          alternatives: ex.alternatives || planEx?.alternatives || [],
          performed: (ex.performed || []).map((p) => ({
            weightKg: p.weightKg ?? null,
            reps: p.reps ?? null,
          })),
          feeling: ex.feeling || null,
          exerciseNote: ex.exerciseNote || '',
          done: !!ex.done,
          optional: !!ex.planned?.optional || !!ex.optional,
          swapped: !!(ex.originalName && ex.originalName !== ex.name),
        }
      }),
    }
  }

  const draft = loadDraft(dateStr)
  if (draft && draft.dayFocus === day.focus) {
    return {
      ...draft,
      fromLog: false,
      completed: false,
      locked: false,
      rest: !!day.rest,
      exercises: (draft.exercises || []).map((ex) => {
        const planEx =
          findPlanExercise(day, ex.originalName || ex.name) ||
          findPlanExercise(day, ex.name)
        return {
          ...ex,
          cues: ex.cues || planEx?.cues || [],
          alternatives: ex.alternatives || planEx?.alternatives || [],
          originalName: ex.originalName || ex.name,
        }
      }),
    }
  }

  return {
    date: dateStr,
    fromLog: false,
    completed: false,
    locked: false,
    overallFeeling: null,
    sessionNote: '',
    dayFocus: day.focus,
    rest: !!day.rest,
    exercises: (day.exercises || []).map((ex) => ({
      id: ex.id || null,
      name: ex.name,
      originalName: ex.name,
      equipment: ex.equipment || null,
      planned: {
        sets: ex.sets,
        reps: ex.reps,
        note: ex.note || '',
        restSec: ex.restSec || null,
        optional: !!ex.optional,
      },
      cues: ex.cues || [],
      alternatives: ex.alternatives || [],
      performed: emptyPerformed(ex.sets),
      feeling: null,
      exerciseNote: '',
      done: false,
      optional: !!ex.optional,
      swapped: false,
    })),
  }
}

function persistDraft() {
  if (!session || session.completed || session.locked || session.rest) return
  saveDraft(session.date, {
    date: session.date,
    dayFocus: session.dayFocus,
    overallFeeling: session.overallFeeling,
    sessionNote: session.sessionNote,
    exercises: session.exercises,
  })
}

function ensureSession() {
  const day = planDayFor(selectedDate)
  if (!session || session.date !== selectedDate) {
    session = buildSessionFromPlan(day, selectedDate)
  }
}

function unitLabel() {
  return settings.unit === 'lb' ? 'lb' : 'kg'
}

function closeSheet() {
  sheetEl?.remove()
  sheetEl = null
}

function openSheet(html, onBind) {
  closeSheet()
  const backdrop = document.createElement('div')
  backdrop.className = 'sheet-backdrop'
  backdrop.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`
  document.body.appendChild(backdrop)
  sheetEl = backdrop
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSheet()
  })
  backdrop.querySelector('[data-close-sheet]')?.addEventListener('click', closeSheet)
  onBind?.(backdrop.querySelector('.sheet'), backdrop)
}

function renderWeekStrip() {
  const today = getZurichDateString()
  const days = getWeekDays(selectedDate)
  return `
    <div class="week-strip" role="tablist" aria-label="Week days">
      ${days
        .map((d) => {
          const planDay = planDayFor(d.date)
          const log = loadLog(d.date)
          const isToday = d.date === today
          const isSel = d.date === selectedDate
          const done = !!log?.completed
          const rest = !!planDay.rest
          return `
            <button type="button" class="day-chip ${isSel ? 'selected' : ''} ${isToday ? 'today' : ''} ${rest ? 'rest' : ''} ${done ? 'done' : ''}"
              data-select-date="${d.date}" role="tab" aria-selected="${isSel}">
              <span class="dow">${d.short}</span>
              <span class="dom">${d.dayNum}</span>
              <span class="dot" aria-hidden="true"></span>
            </button>`
        })
        .join('')}
    </div>
    <div class="week-nav">
      <button type="button" class="btn-icon" data-week-shift="-7" aria-label="Previous week">${icon('chevron-left')}</button>
      <span class="week-label">${displayDateFor(days[0].date)} – ${displayDateFor(days[6].date)}</span>
      <button type="button" class="btn-icon" data-week-shift="7" aria-label="Next week">${icon('chevron-right')}</button>
      ${selectedDate !== today ? `<button type="button" class="btn-text" data-jump-today>Today</button>` : ''}
    </div>
  `
}

function render() {
  ensureSession()
  const today = getZurichDateString()
  const day = planDayFor(selectedDate)
  const isToday = selectedDate === today

  app.innerHTML = `
    <header class="app-header">
      <div class="header-top">
        <div>
          <p class="eyebrow">${view === 'settings' ? 'Account' : (isToday ? 'This week' : 'Week view')}</p>
          <h1>${view === 'settings' ? 'Settings' : (session.rest ? 'Rest' : escapeHtml(session.dayFocus))}</h1>
        </div>
        <div class="header-meta">
          ${view === 'settings' ? '' : `<span class="pill">${isToday ? 'Today' : SHORT_LABELS[weekdayKeyFor(selectedDate)] || ''}</span>`}
          <span class="pill muted">${settings.unit.toUpperCase()}</span>
          ${
            view !== 'settings' && session.overallFeeling
              ? `<span class="pill feeling-${escapeHtml(session.overallFeeling)}">${escapeHtml(session.overallFeeling)}</span>`
              : ''
          }
        </div>
      </div>
      ${
        view === 'settings'
          ? `<div class="sub">Drive sync · units · on-device history</div>`
          : `<div class="sub">${displayDateFor(selectedDate)} · ${TZ}</div>
      <div class="badge-row">
        <span class="badge accent">${day.rest ? 'Rest day' : escapeHtml(day.focus)}</span>
        ${
          session.locked
            ? `<span class="badge ok">Logged</span>`
            : drive.isSignedIn()
              ? `<span class="badge ok">${icon('cloud-sync', 'ico')} Connected</span>`
              : drive.isConfigured()
                ? `<span class="badge">${icon('cloud-off', 'ico')} Drive off</span>`
                : `<span class="badge">Local</span>`
        }
      </div>
      ${renderWeekStrip()}`
      }
    </header>
    <main id="main"></main>
    <nav class="nav">
      <div class="nav-inner">
        <button type="button" data-nav="today" class="${view === 'today' ? 'active' : ''}">
          <span class="nav-ico">${icon('nav-today')}</span> Workout
        </button>
        <button type="button" data-nav="settings" class="${view === 'settings' ? 'active' : ''}">
          <span class="nav-ico">${icon('nav-settings')}</span> Settings
        </button>
      </div>
    </nav>
  `

  const main = app.querySelector('#main')
  if (view === 'settings') {
    main.innerHTML = renderSettings()
    bindSettings(main)
  } else if (session.locked) {
    main.innerHTML = renderLockedHistory()
    bindHistory(main)
  } else if (day.rest || session.rest) {
    main.innerHTML = renderRest()
    bindRest(main)
  } else {
    main.innerHTML = renderWorkout()
    bindWorkout(main)
  }

  app.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view = btn.dataset.nav
      render()
    })
  })

  app.querySelectorAll('[data-select-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDate = btn.dataset.selectDate
      session = null
      view = 'today'
      render()
    })
  })

  app.querySelectorAll('[data-week-shift]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDate = addDays(selectedDate, Number(btn.dataset.weekShift))
      session = null
      render()
    })
  })

  app.querySelector('[data-jump-today]')?.addEventListener('click', () => {
    selectedDate = getZurichDateString()
    session = null
    render()
  })
}

function renderRest() {
  const next = nextTrainingDay(plan, selectedDate)
  const nextLabel = next
    ? `${escapeHtml(SHORT_LABELS[next.key])} ${escapeHtml(next.day.focus)} · ${escapeHtml(displayDateFor(next.date))}`
    : '—'
  const previewExercises = (next?.day?.exercises || [])
    .slice(0, 4)
    .map((e) => `<li><strong>${escapeHtml(e.name)}</strong><span>${escapeHtml(e.sets)}×${escapeHtml(e.reps)}</span></li>`)
    .join('')

  return `
    <section class="rest-hero card">
      <div class="rest-icon" aria-hidden="true">${icon('rest')}</div>
      <p class="eyebrow">Recovery</p>
      <h2>Rest day</h2>
      <p class="lead">Walk, stretch, sleep. Next hard session is locked in.</p>
    </section>
    <section class="card preview-card">
      <div class="card-head">
        <h3>Tomorrow — ${escapeHtml(next?.day?.focus || 'Next')}</h3>
        <span class="pill muted">${next ? SHORT_LABELS[next.key] : '—'}</span>
      </div>
      <p class="meta">${nextLabel}</p>
      ${previewExercises ? `<ul class="preview-list">${previewExercises}</ul>` : ''}
    </section>
    <div class="rest-actions">
      ${
        next
          ? `<button type="button" class="btn btn-secondary" id="preview-tomorrow">Preview tomorrow</button>`
          : ''
      }
      ${
        !session.completed
          ? `<button type="button" class="btn btn-secondary" id="finish-rest">Log rest day</button>`
          : `<div class="banner completed-banner">Rest logged · ${session.overallFeeling || 'done'}</div>`
      }
    </div>
  `
}

function bindRest(main) {
  main.querySelector('#finish-rest')?.addEventListener('click', () => openFinishModal(true))
  main.querySelector('#preview-tomorrow')?.addEventListener('click', () => {
    const next = nextTrainingDay(plan, selectedDate)
    if (!next) return
    selectedDate = next.date
    session = null
    render()
  })
}

function renderLockedHistory() {
  const unit = unitLabel()
  const exercisesHtml = session.exercises
    .map((ex, i) => {
      const sets = (ex.performed || [])
        .map((s, si) => {
          const w = s.weightKg != null ? displayWeight(s.weightKg, settings.unit) : '—'
          const r = s.reps != null ? s.reps : '—'
          return `<div class="hist-set"><span class="n">${si + 1}</span><span class="val">${w} ${unit}</span><span class="reps">× ${r}</span></div>`
        })
        .join('')
      return `
        <article class="card hist-card">
          <div class="card-head">
            <h2>${escapeHtml(ex.name)}</h2>
            ${ex.feeling ? `<span class="pill feeling-${escapeHtml(ex.feeling)}">${escapeHtml(ex.feeling)}</span>` : ''}
          </div>
          ${ex.swapped ? `<p class="swap-ref">Swapped from ${escapeHtml(ex.originalName)}</p>` : ''}
          <div class="hist-sets">${sets || '<p class="meta">No sets logged</p>'}</div>
          ${ex.exerciseNote ? `<p class="note-line">${escapeHtml(ex.exerciseNote)}</p>` : ''}
          <button type="button" class="btn-text" data-open-detail="${i}">Cues & form</button>
        </article>`
    })
    .join('')

  const recent = listLockedLogs()
    .filter((l) => l.date !== session.date)
    .slice(0, 6)
    .map(
      (l) =>
        `<button type="button" class="recent-row" data-select-date="${l.date}">
          <span>${escapeHtml(displayDateFor(l.date))}</span>
          <strong>${escapeHtml(l.dayFocus || 'Session')}</strong>
          <span class="pill">${escapeHtml(l.overallFeeling || 'done')}</span>
        </button>`,
    )
    .join('')

  return `
    <div class="banner completed-banner locked-banner">
      <div>
        <strong>Logged · read only</strong>
        <p>${escapeHtml(displayDateFor(session.date))} · ${escapeHtml(session.overallFeeling || 'done')}</p>
      </div>
      <span class="lock-ico" aria-hidden="true">${icon('lock')}</span>
    </div>
    ${session.sessionNote ? `<div class="card note-card"><p>${escapeHtml(session.sessionNote)}</p></div>` : ''}
    ${exercisesHtml}
    ${
      recent
        ? `<section class="card"><div class="card-head"><h3>Previous sessions</h3></div><div class="recent-list">${recent}</div></section>`
        : ''
    }
  `
}

function bindHistory(main) {
  main.querySelectorAll('[data-select-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDate = btn.dataset.selectDate
      session = null
      render()
    })
  })
  main.querySelectorAll('[data-open-detail]').forEach((btn) => {
    btn.addEventListener('click', () => openExerciseSheet(Number(btn.dataset.openDetail), true))
  })
}

function renderWorkout() {
  const exercisesHtml = session.exercises.map((ex, i) => renderExercise(ex, i)).join('')
  return `
    <div class="card session-hero">
      <div class="card-head">
        <h2>${escapeHtml(session.dayFocus)}</h2>
        <span class="pill muted">${session.exercises.length} exercises</span>
      </div>
      <p class="meta">${session.exercises.length} exercises · leave 1–2 RIR on main lifts</p>
    </div>
    ${
      !drive.isSignedIn()
        ? `<div class="banner">${
            drive.isConfigured()
              ? 'Logs save locally. <button type="button" data-goto-settings>Connect Drive</button>'
              : 'Offline mode — localStorage only.'
          }</div>`
        : ''
    }
    ${exercisesHtml}
    <button type="button" class="btn btn-primary" id="open-finish">Finish workout</button>
  `
}

function renderExercise(ex, index) {
  const unit = unitLabel()
  const rest = formatRest(ex.planned.restSec)
  const sets = ex.performed
    .map(
      (s, si) => `
      <div class="set-row" data-ex="${index}" data-set="${si}">
        <div class="n">${si + 1}</div>
        <input inputmode="decimal" type="number" step="0.5" min="0"
          placeholder="${unit}" data-field="weight"
          value="${s.weightKg != null ? displayWeight(s.weightKg, settings.unit) : ''}" />
        <input inputmode="numeric" type="number" step="1" min="0"
          placeholder="reps" data-field="reps"
          value="${s.reps != null ? s.reps : ''}" />
      </div>`,
    )
    .join('')

  const chips = FEELINGS.map(
    (f) =>
      `<button type="button" class="chip ${f.id} ${ex.feeling === f.id ? 'active' : ''}" data-feeling="${f.id}" data-ex="${index}">${f.label}</button>`,
  ).join('')

  return `
    <article class="card ex-card ${ex.done ? 'is-done' : ''}" data-exercise="${index}">
      <div class="ex-top">
        <div class="ex-diagram">${diagramFor(ex.name)}</div>
        <div class="ex-title">
          <h2>${escapeHtml(ex.name)}${ex.optional ? '<span class="optional-tag">Optional</span>' : ''}</h2>
          <div class="meta">${escapeHtml(ex.planned.sets)}×${escapeHtml(ex.planned.reps)}${ex.planned.note ? ` · ${escapeHtml(ex.planned.note)}` : ''}${rest ? ` · ${escapeHtml(rest)}` : ''}</div>
          ${ex.swapped ? `<div class="swap-ref">Was: ${escapeHtml(ex.originalName)}</div>` : ''}
        </div>
      </div>
      <div class="ex-actions">
        <button type="button" class="btn btn-ghost sm" data-open-detail="${index}">${icon('cues', 'ico')} How-to</button>
        <button type="button" class="btn btn-ghost sm" data-open-swap="${index}">${icon('swap', 'ico')} Swap</button>
      </div>
      <div class="set-cols" aria-hidden="true"><span>#</span><span>${unit.toUpperCase()}</span><span>REPS</span></div>
      <div class="sets">${sets}</div>
      <div class="chips">${chips}</div>
      <textarea placeholder="Exercise note" data-ex-note="${index}">${escapeHtml(ex.exerciseNote || '')}</textarea>
      <div class="row-actions">
        <button type="button" class="btn btn-done ${ex.done ? 'on' : ''}" data-toggle-done="${index}">
          ${ex.done ? `${icon('check', 'ico')} Done` : 'Mark done'}
        </button>
      </div>
    </article>
  `
}

function bindWorkout(main) {
  main.querySelector('[data-goto-settings]')?.addEventListener('click', () => {
    view = 'settings'
    render()
  })
  main.querySelector('#open-finish')?.addEventListener('click', () => openFinishModal(false))

  main.querySelectorAll('.set-row input').forEach((input) => {
    input.addEventListener('change', () => {
      const row = input.closest('.set-row')
      const ei = Number(row.dataset.ex)
      const si = Number(row.dataset.set)
      const field = input.dataset.field
      if (field === 'weight') {
        session.exercises[ei].performed[si].weightKg = inputWeightToKg(input.value, settings.unit)
      } else {
        const v = input.value === '' ? null : Number(input.value)
        session.exercises[ei].performed[si].reps = Number.isNaN(v) ? null : v
      }
      persistDraft()
    })
  })

  main.querySelectorAll('[data-feeling]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ei = Number(btn.dataset.ex)
      session.exercises[ei].feeling = btn.dataset.feeling
      persistDraft()
      render()
    })
  })

  main.querySelectorAll('[data-ex-note]').forEach((ta) => {
    ta.addEventListener('change', () => {
      const ei = Number(ta.dataset.exNote)
      session.exercises[ei].exerciseNote = ta.value
      persistDraft()
    })
  })

  main.querySelectorAll('[data-toggle-done]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ei = Number(btn.dataset.toggleDone)
      session.exercises[ei].done = !session.exercises[ei].done
      persistDraft()
      render()
    })
  })

  main.querySelectorAll('[data-open-detail]').forEach((btn) => {
    btn.addEventListener('click', () => openExerciseSheet(Number(btn.dataset.openDetail), false))
  })

  main.querySelectorAll('[data-open-swap]').forEach((btn) => {
    btn.addEventListener('click', () => openSwapSheet(Number(btn.dataset.openSwap)))
  })
}

function renderHowtoDemo(ex) {
  const demo = getDemoForExercise(ex)
  if (demo?.loop) {
    const src = demoAssetUrl(demo.loop)
    return `<div class="howto-demo"><img src="${escapeHtml(src)}" alt="${escapeHtml(ex.name)} demo" loading="lazy" /></div>`
  }
  if (demo?.frames?.length) {
    const frames = demo.frames
      .map(
        (f) => `<figure class="howto-demo-frame">
          <img src="${escapeHtml(demoAssetUrl(f.file))}" alt="${escapeHtml(f.label)}" loading="lazy" />
          <figcaption>${escapeHtml(f.label)}</figcaption>
        </figure>`,
      )
      .join('')
    return `<div class="howto-demo"><div class="howto-demo-strip">${frames}</div></div>`
  }
  const cues = normalizeCues(ex.cues)
  const steps = [
    ...(cues.setup.slice(0, 1).map((s) => `1. Setup — ${s}`)),
    ...(cues.move.slice(0, 2).map((s, i) => `${i + 2}. Move — ${s}`)),
    ...(cues.avoid.slice(0, 1).map((s) => `Avoid — ${s}`)),
  ]
  return `<div class="howto-demo"><div class="howto-demo-placeholder">
    <strong>Demo media coming soon</strong>
    <span>Follow Setup → Move → Avoid below${steps.length ? ':' : '.'}</span>
    ${steps.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}
  </div></div>`
}

function renderCueBlocks(ex) {
  const cues = normalizeCues(ex.cues)
  const block = (label, lines) => {
    if (!lines?.length) return ''
    return `<div class="cue-block">
      <h3 class="sheet-section">${label}</h3>
      <ul class="cue-lines">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
    </div>`
  }
  const html =
    block('Setup', cues.setup) + block('Move', cues.move) + block('Avoid', cues.avoid)
  if (html) return html
  return `<div class="cue-block"><h3 class="sheet-section">Move</h3>
    <ul class="cue-lines"><li>Move with control; stop 1–2 reps shy of failure on compounds.</li></ul></div>`
}

function openExerciseSheet(index, readOnly) {
  const ex = session.exercises[index]
  if (!ex) return
  const demoMeta = getDemoForExercise(ex)
  const equipment = ex.equipment || demoMeta?.equipment || 'Free weight'
  const alts = (ex.alternatives || [])
    .map(
      (a, ai) => `
      <button type="button" class="alt-row ${readOnly ? 'locked-alt' : ''}" data-swap-to="${ai}" ${readOnly ? 'disabled' : ''}>
        <strong>${escapeHtml(a.name)}${readOnly ? `<span class="lock-micro">${icon('lock')}</span>` : ''}</strong>
        <span>${escapeHtml(a.note || 'Alternative')}</span>
      </button>`,
    )
    .join('')

  openSheet(
    `
    <div class="sheet-handle"></div>
    ${renderHowtoDemo(ex)}
    <div class="howto-title-row">
      <div>
        <h2>${escapeHtml(ex.name)}</h2>
        <p class="meta">${escapeHtml(ex.planned.sets)}×${escapeHtml(ex.planned.reps)}${formatRest(ex.planned.restSec) ? ` · ${escapeHtml(formatRest(ex.planned.restSec))}` : ''}</p>
      </div>
      <span class="equip-chip">${escapeHtml(equipment)}</span>
    </div>
    ${renderCueBlocks(ex)}
    ${
      alts
        ? `<h3 class="sheet-section">Alternatives</h3>
           <div class="alt-list">${alts}</div>
           ${!readOnly ? `<p class="hint">Tap an alternative to swap it into this session.</p>` : `<p class="hint">Read-only — alternatives shown for reference.</p>`}`
        : ''
    }
    <div class="sheet-actions">
      ${
        !readOnly && (ex.alternatives || []).length
          ? `<button type="button" class="btn btn-secondary" data-open-swap-from-detail>${icon('swap', 'ico')} Swap alternative</button>`
          : ''
      }
      ${
        ex.swapped && !readOnly
          ? `<button type="button" class="btn btn-secondary" data-restore-original>Restore ${escapeHtml(ex.originalName)}</button>`
          : ''
      }
      <button type="button" class="btn btn-ghost" data-close-sheet style="width:100%">${icon('close', 'ico')} Close</button>
    </div>
  `,
    (sheet) => {
      sheet.querySelectorAll('[data-swap-to]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (readOnly) return
          applySwap(index, ex.alternatives[Number(btn.dataset.swapTo)])
          closeSheet()
          render()
          toast(`Swapped → ${session.exercises[index].name}`)
        })
      })
      sheet.querySelector('[data-restore-original]')?.addEventListener('click', () => {
        restoreOriginal(index)
        closeSheet()
        render()
        toast('Restored original exercise')
      })
      sheet.querySelector('[data-open-swap-from-detail]')?.addEventListener('click', () => {
        closeSheet()
        openSwapSheet(index)
      })
    },
  )
}

function openSwapSheet(index) {
  const ex = session.exercises[index]
  if (!ex) return
  const alts = ex.alternatives || []
  if (!alts.length) {
    toast('No alternatives listed')
    return
  }
  openSheet(
    `
    <div class="sheet-handle"></div>
    <h2>Swap exercise</h2>
    <p class="hint">Machine busy? Pick a swap for this session. Original stays as reference.</p>
    <p class="meta" style="margin-bottom:12px">Current: <strong>${escapeHtml(ex.name)}</strong></p>
    <div class="alt-list">
      ${alts
        .map(
          (a, ai) => `
        <button type="button" class="alt-row" data-swap-to="${ai}">
          <strong>${escapeHtml(a.name)}</strong>
          <span>${escapeHtml(a.note || 'Use same sets/reps unless noted')}</span>
        </button>`,
        )
        .join('')}
    </div>
    ${
      ex.swapped
        ? `<button type="button" class="btn btn-secondary" data-restore-original style="margin-top:12px">Restore ${escapeHtml(ex.originalName)}</button>`
        : ''
    }
    <button type="button" class="btn btn-ghost" data-close-sheet style="width:100%;margin-top:8px">Cancel</button>
  `,
    (sheet) => {
      sheet.querySelectorAll('[data-swap-to]').forEach((btn) => {
        btn.addEventListener('click', () => {
          applySwap(index, alts[Number(btn.dataset.swapTo)])
          closeSheet()
          render()
          toast(`Swapped → ${session.exercises[index].name}`)
        })
      })
      sheet.querySelector('[data-restore-original]')?.addEventListener('click', () => {
        restoreOriginal(index)
        closeSheet()
        render()
      })
    },
  )
}

function applySwap(index, alt) {
  if (!alt) return
  const ex = session.exercises[index]
  const original = ex.originalName || ex.name
  ex.originalName = original
  ex.name = alt.name
  ex.swapped = true
  if (alt.note) {
    ex.planned = { ...ex.planned, note: [ex.planned.note, alt.note].filter(Boolean).join(' · ') }
  }
  // Keep cues from original plan exercise; try to attach alt-specific if same plan has it
  persistDraft()
}

function restoreOriginal(index) {
  const ex = session.exercises[index]
  const day = planDayFor(session.date)
  const planEx = findPlanExercise(day, ex.originalName)
  ex.name = ex.originalName
  ex.swapped = false
  if (planEx) {
    ex.planned = {
      sets: planEx.sets,
      reps: planEx.reps,
      note: planEx.note || '',
      restSec: planEx.restSec || null,
      optional: !!planEx.optional,
    }
    ex.cues = planEx.cues || []
    ex.alternatives = planEx.alternatives || []
  }
  persistDraft()
}

function openFinishModal(isRest) {
  const backdrop = document.createElement('div')
  backdrop.className = 'sheet-backdrop'
  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <h2>${isRest ? 'Log rest day' : 'Finish workout'}</h2>
      <p class="hint">Locks this session as read-only history${drive.isSignedIn() ? ' and syncs to Drive' : ''}.</p>
      <div class="field">
        <label>Overall feeling</label>
        <div class="chips" id="overall-chips">
          ${FEELINGS.map(
            (f) =>
              `<button type="button" class="chip ${f.id} ${session.overallFeeling === f.id ? 'active' : ''}" data-overall="${f.id}">${f.label}</button>`,
          ).join('')}
        </div>
      </div>
      <div class="field">
        <label>Session note</label>
        <textarea id="session-note" placeholder="How did it feel overall?">${escapeHtml(session.sessionNote || '')}</textarea>
      </div>
      <button type="button" class="btn btn-primary" id="confirm-finish">Lock & save</button>
      <button type="button" class="btn btn-ghost" id="cancel-finish" style="width:100%;margin-top:8px">Cancel</button>
    </div>
  `
  document.body.appendChild(backdrop)

  backdrop.querySelectorAll('[data-overall]').forEach((btn) => {
    btn.addEventListener('click', () => {
      session.overallFeeling = btn.dataset.overall
      backdrop.querySelectorAll('[data-overall]').forEach((b) => {
        b.classList.toggle('active', b.dataset.overall === session.overallFeeling)
      })
    })
  })

  backdrop.querySelector('#cancel-finish').addEventListener('click', () => backdrop.remove())
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove()
  })

  backdrop.querySelector('#confirm-finish').addEventListener('click', async () => {
    session.sessionNote = backdrop.querySelector('#session-note').value || ''
    if (!session.overallFeeling) {
      toast('Pick an overall feeling')
      return
    }
    const btn = backdrop.querySelector('#confirm-finish')
    btn.disabled = true
    btn.textContent = 'Saving…'
    try {
      await finishDay(isRest)
      backdrop.remove()
      toast(drive.isSignedIn() ? 'Locked + synced to Drive' : 'Locked on this device')
      render()
    } catch (err) {
      console.error(safeErrMsg(err))
      toast(`Locked locally. Drive sync failed: ${safeErrMsg(err)}`)
      backdrop.remove()
      render()
    }
  })
}

function buildLogPayload(isRest) {
  return {
    date: session.date,
    timezone: TZ,
    dayFocus: session.dayFocus,
    completed: true,
    locked: true,
    rest: !!isRest || !!session.rest,
    overallFeeling: session.overallFeeling,
    sessionNote: session.sessionNote || '',
    exercises: (session.exercises || []).map((ex) => ({
      name: ex.name,
      originalName: ex.originalName || ex.name,
      planned: {
        sets: ex.planned.sets,
        reps: ex.planned.reps,
        note: ex.planned.note || '',
        restSec: ex.planned.restSec || null,
        ...(ex.optional ? { optional: true } : {}),
      },
      performed: ex.performed
        .filter((p) => p.weightKg != null || p.reps != null)
        .map((p) => ({
          weightKg: p.weightKg,
          reps: p.reps,
        })),
      feeling: ex.feeling,
      exerciseNote: ex.exerciseNote || '',
      done: !!ex.done,
      cues: ex.cues || [],
      alternatives: ex.alternatives || [],
    })),
    updatedAt: getZurichIsoNow(),
  }
}

async function finishDay(isRest = false) {
  const log = buildLogPayload(isRest)
  saveLog(session.date, log)
  clearDraft(session.date)
  session.completed = true
  session.locked = true
  session.fromLog = true

  if (drive.isSignedIn()) {
    const { folderIds } = await drive.saveLogToDrive(settings, session.date, log)
    settings.folderIds = { ...settings.folderIds, ...folderIds }
    settings.driveConnected = true
    saveSettings(settings)
  }
}

function renderSettings() {
  const ids = settings.folderIds
  const logs = listLockedLogs()
  return `
    <div class="card settings-block">
      <h3>Units</h3>
      <div class="unit-toggle">
        <button type="button" data-unit="kg" class="${settings.unit === 'kg' ? 'active' : ''}">kg</button>
        <button type="button" data-unit="lb" class="${settings.unit === 'lb' ? 'active' : ''}">lb</button>
      </div>
    </div>

    <div class="card settings-block">
      <h3>Google Drive</h3>
      <p>${
        drive.isConfigured()
          ? drive.isSignedIn()
            ? `${icon('cloud-sync', 'ico')} <span class="pill feeling-easy" style="margin-left:6px">Connected</span><br/>Prefers plan-v2.json, else plan.json. Logs upload on Finish day.`
            : `${icon('cloud-off', 'ico')} <span class="pill muted" style="margin-left:6px">Not connected</span><br/>Client ID found. Sign in to sync plan + workout logs.`
          : 'No VITE_GOOGLE_CLIENT_ID — offline localStorage mode.'
      }</p>
      ${
        drive.isConfigured()
          ? drive.isSignedIn()
            ? `<button type="button" class="btn btn-secondary" id="drive-disconnect" style="margin-top:10px">Disconnect</button>
               <button type="button" class="btn btn-primary" id="drive-refresh-plan" style="margin-top:8px">Refresh plan from Drive</button>`
            : `<button type="button" class="btn btn-primary" id="drive-connect" style="margin-top:10px">Connect Google Drive</button>`
          : `<p style="margin-top:8px">See README for OAuth setup.</p>`
      }
    </div>

    <div class="card settings-block">
      <h3>History on device</h3>
      <p>${logs.length} locked session${logs.length === 1 ? '' : 's'} cached</p>
      <div class="recent-list" style="margin-top:10px">
        ${
          logs
            .slice(0, 8)
            .map(
              (l) =>
                `<button type="button" class="recent-row" data-jump-log="${l.date}">
                  <span>${escapeHtml(displayDateFor(l.date))}</span>
                  <strong>${escapeHtml(l.dayFocus || 'Session')}</strong>
                  <span class="pill">Locked</span>
                </button>`,
            )
            .join('') || '<p class="meta">No locked logs yet</p>'
        }
      </div>
    </div>

    <div class="card settings-block">
      <h3>Folder IDs</h3>
      <p>Fitness Coach<br/><code>${escapeHtml(ids.fitnessCoach || '—')}</code></p>
      <p style="margin-top:8px">logs/<br/><code>${escapeHtml(ids.logs || '—')}</code></p>
      <p style="margin-top:8px">plan file<br/><code>${escapeHtml(ids.plan || '—')}</code></p>
      <button type="button" class="btn btn-ghost" id="reset-folder-ids" style="margin-top:8px">Reset to defaults</button>
    </div>

    <div class="card settings-block">
      <h3>About</h3>
      <p>Strength plan · intermediate · full gym · Europe/Zurich.</p>
      <p style="margin-top:6px">Plan version: ${plan.planVersion ?? 1}</p>
      <p style="margin-top:6px">Week nav · locked history · cues · exercise swaps</p>
    </div>
  `
}

function bindSettings(main) {
  main.querySelectorAll('[data-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      settings.unit = btn.dataset.unit
      saveSettings(settings)
      if (plan) {
        plan.unit = settings.unit
        savePlanLocal(plan)
      }
      render()
      toast(`Units: ${settings.unit}`)
    })
  })

  main.querySelectorAll('[data-jump-log]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDate = btn.dataset.jumpLog
      session = null
      view = 'today'
      render()
    })
  })

  main.querySelector('#drive-connect')?.addEventListener('click', async () => {
    try {
      await drive.signIn()
      settings.driveConnected = true
      saveSettings(settings)
      toast('Drive connected')
      await refreshPlanFromDrive(true)
      render()
    } catch (err) {
      console.error(safeErrMsg(err))
      toast(safeErrMsg(err) || 'Sign-in failed')
    }
  })

  main.querySelector('#drive-disconnect')?.addEventListener('click', () => {
    drive.signOut()
    settings.driveConnected = false
    settings.googleEmail = null
    saveSettings(settings)
    toast('Disconnected')
    render()
  })

  main.querySelector('#drive-refresh-plan')?.addEventListener('click', async () => {
    try {
      await refreshPlanFromDrive(true)
      toast('Plan refreshed')
      render()
    } catch (err) {
      toast(safeErrMsg(err) || 'Refresh failed')
    }
  })

  main.querySelector('#reset-folder-ids')?.addEventListener('click', () => {
    settings.folderIds = {
      fitnessCoach: '1GCzaDOcj-jHmbMCxh7YEVDb8AqQNJ-c-',
      logs: '1W4Wwho9JYB0bCvGUsbuwAhwgtoF04IBO',
      plan: '1okdWjmCZkGAKnigHh2qF8rackLGzurUX',
    }
    saveSettings(settings)
    toast('Folder IDs reset')
    render()
  })
}

async function refreshPlanFromDrive(force) {
  if (!drive.isSignedIn()) return
  const { plan: remote, folderIds, planFile } = await drive.fetchPlanFromDrive(settings)
  plan = remote
  savePlanLocal(plan)
  settings.folderIds = { ...settings.folderIds, ...folderIds }
  if (remote.unit === 'kg' || remote.unit === 'lb') {
    settings.unit = remote.unit
  }
  saveSettings(settings)
  if (!loadLog(selectedDate)?.completed) {
    session = buildSessionFromPlan(planDayFor(selectedDate), selectedDate)
  }
  if (force) toast(`Loaded ${planFile || 'plan'} from Drive`)
}

async function boot() {
  ensureSeedLog(seedLog)
  plan = mergePlanPreferNewer(loadPlanLocal(), seedPlan)
  savePlanLocal(plan)
  if (!settings.unit && plan.unit) settings.unit = plan.unit
  saveSettings(settings)

  selectedDate = getZurichDateString()
  render()

  if (drive.isConfigured()) {
    try {
      await drive.initGoogle()
      if (settings.driveConnected || drive.isSignedIn()) {
        try {
          await drive.ensureSignedIn({ allowConsent: false })
          settings.driveConnected = true
          saveSettings(settings)
          await refreshPlanFromDrive(false)
          render()
        } catch {
          /* silent refresh failed — keep UI; user can Connect manually */
          render()
        }
      }
    } catch (err) {
      console.warn('Google init failed', safeErrMsg(err))
    }
  }
}

boot()
