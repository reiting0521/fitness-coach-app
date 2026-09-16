import './style.css'
import seedPlan from './plan.json'
import {
  getZurichDateString,
  getZurichWeekdayKey,
  getZurichDisplayDate,
  getZurichIsoNow,
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
let plan = loadPlanLocal() || seedPlan
let view = 'today' // today | settings
let session = null // working session state for today
let toastTimer = null

const app = document.querySelector('#app')

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

function todayPlanDay() {
  const key = getZurichWeekdayKey()
  return plan.week?.[key] || { focus: 'Rest', rest: true, exercises: [] }
}

function emptyPerformed(sets) {
  return Array.from({ length: Math.max(1, sets || 1) }, () => ({
    weightKg: null,
    reps: null,
  }))
}

function buildSessionFromPlan(day, dateStr) {
  const existingLog = loadLog(dateStr)
  if (existingLog?.completed) {
    return {
      date: dateStr,
      fromLog: true,
      completed: true,
      overallFeeling: existingLog.overallFeeling || null,
      sessionNote: existingLog.sessionNote || '',
      dayFocus: existingLog.dayFocus || day.focus,
      rest: !!day.rest,
      exercises: (existingLog.exercises || []).map((ex) => ({
        name: ex.name,
        planned: ex.planned || { sets: 1, reps: '', note: '' },
        performed: (ex.performed || []).map((p) => ({
          weightKg: p.weightKg ?? null,
          reps: p.reps ?? null,
        })),
        feeling: ex.feeling || null,
        exerciseNote: ex.exerciseNote || '',
        done: !!ex.done,
        optional: !!ex.planned?.optional || !!ex.optional,
      })),
    }
  }

  const draft = loadDraft(dateStr)
  if (draft && draft.dayFocus === day.focus) {
    return { ...draft, fromLog: false, completed: false, rest: !!day.rest }
  }

  return {
    date: dateStr,
    fromLog: false,
    completed: false,
    overallFeeling: null,
    sessionNote: '',
    dayFocus: day.focus,
    rest: !!day.rest,
    exercises: (day.exercises || []).map((ex) => ({
      name: ex.name,
      planned: {
        sets: ex.sets,
        reps: ex.reps,
        note: ex.note || '',
        optional: !!ex.optional,
      },
      performed: emptyPerformed(ex.sets),
      feeling: null,
      exerciseNote: '',
      done: false,
      optional: !!ex.optional,
    })),
  }
}

function persistDraft() {
  if (!session || session.completed || session.rest) return
  saveDraft(session.date, {
    date: session.date,
    dayFocus: session.dayFocus,
    overallFeeling: session.overallFeeling,
    sessionNote: session.sessionNote,
    exercises: session.exercises,
  })
}

function ensureSession() {
  const dateStr = getZurichDateString()
  const day = todayPlanDay()
  if (!session || session.date !== dateStr) {
    session = buildSessionFromPlan(day, dateStr)
  }
}

function unitLabel() {
  return settings.unit === 'lb' ? 'lb' : 'kg'
}

function render() {
  ensureSession()
  const dateStr = getZurichDateString()
  const display = getZurichDisplayDate()
  const day = todayPlanDay()

  app.innerHTML = `
    <header class="app-header">
      <h1>Fitness Coach</h1>
      <div class="sub">${display} · ${TZ}</div>
      <div class="badge-row">
        <span class="badge accent">${day.rest ? 'Rest' : day.focus}</span>
        <span class="badge">${settings.unit.toUpperCase()}</span>
        <span class="badge ${drive.isSignedIn() ? 'ok' : ''}">${
          drive.isSignedIn() ? 'Drive connected' : drive.isConfigured() ? 'Drive offline' : 'Local only'
        }</span>
      </div>
    </header>
    <main id="main"></main>
    <nav class="nav">
      <div class="nav-inner">
        <button type="button" data-nav="today" class="${view === 'today' ? 'active' : ''}">Today</button>
        <button type="button" data-nav="settings" class="${view === 'settings' ? 'active' : ''}">Settings</button>
      </div>
    </nav>
  `

  const main = app.querySelector('#main')
  if (view === 'settings') {
    main.innerHTML = renderSettings()
    bindSettings(main)
  } else if (day.rest || session.rest) {
    main.innerHTML = renderRest()
    main.querySelector('#finish-rest')?.addEventListener('click', () => openFinishModal(true))
  } else {
    main.innerHTML = renderToday()
    bindToday(main)
  }

  app.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view = btn.dataset.nav
      render()
    })
  })
}

function renderRest() {
  const done = session?.completed
  return `
    <div class="card rest-hero">
      <div class="emoji">😴</div>
      <h2>Rest day</h2>
      <p>Recovery is training. Walk, stretch, sleep well.</p>
      ${
        done
          ? `<p class="meta" style="margin-top:16px">Logged · feeling: ${session.overallFeeling || '—'}</p>`
          : ''
      }
    </div>
    ${
      !drive.isSignedIn() && drive.isConfigured()
        ? `<div class="banner">Connect Google Drive in Settings to sync logs.</div>`
        : !drive.isConfigured()
          ? `<div class="banner">Works offline. Add <code>VITE_GOOGLE_CLIENT_ID</code> to enable Drive sync.</div>`
          : ''
    }
    ${
      !done
        ? `<button type="button" class="btn btn-primary" id="finish-rest">Mark rest day done</button>`
        : `<div class="banner completed-banner">Rest day logged for ${session.date}.</div>`
    }
  `
}

function renderToday() {
  const exercisesHtml = session.exercises
    .map((ex, i) => renderExercise(ex, i))
    .join('')

  return `
    ${
      session.completed
        ? `<div class="banner completed-banner">Session completed · ${session.overallFeeling || 'logged'}</div>`
        : ''
    }
    ${
      !drive.isSignedIn() && !session.completed
        ? `<div class="banner">${
            drive.isConfigured()
              ? 'Not signed in — logs save locally. <button type="button" data-goto-settings>Connect Drive</button>'
              : 'Offline mode — logs save to this device. Set VITE_GOOGLE_CLIENT_ID for Drive sync.'
          }</div>`
        : ''
    }
    <div class="card" style="margin-bottom:14px">
      <h2>${session.dayFocus}</h2>
      <div class="meta">${session.exercises.length} exercises · leave 1–2 RIR on main lifts</div>
    </div>
    ${exercisesHtml}
    ${
      !session.completed
        ? `<button type="button" class="btn btn-primary" id="open-finish">Finish day</button>`
        : `<button type="button" class="btn btn-secondary" id="reopen-edit">Edit today's log</button>`
    }
  `
}

function renderExercise(ex, index) {
  const unit = unitLabel()
  const sets = ex.performed
    .map(
      (s, si) => `
      <div class="set-row" data-ex="${index}" data-set="${si}">
        <div class="n">${si + 1}</div>
        <input inputmode="decimal" type="number" step="0.5" min="0"
          placeholder="${unit}" data-field="weight"
          value="${s.weightKg != null ? displayWeight(s.weightKg, settings.unit) : ''}"
          ${session.completed ? 'readonly' : ''} />
        <input inputmode="numeric" type="number" step="1" min="0"
          placeholder="reps" data-field="reps"
          value="${s.reps != null ? s.reps : ''}"
          ${session.completed ? 'readonly' : ''} />
      </div>`,
    )
    .join('')

  const chips = FEELINGS.map(
    (f) =>
      `<button type="button" class="chip ${f.id} ${ex.feeling === f.id ? 'active' : ''}" data-feeling="${f.id}" data-ex="${index}" ${session.completed ? 'disabled' : ''}>${f.label}</button>`,
  ).join('')

  return `
    <article class="card" data-exercise="${index}">
      <h2>${ex.name}${ex.optional ? '<span class="optional-tag">Optional</span>' : ''}</h2>
      <div class="meta">${ex.planned.sets}×${ex.planned.reps}${ex.planned.note ? ` · ${ex.planned.note}` : ''}</div>
      <div class="sets">${sets}</div>
      <div class="chips" data-ex-feeling="${index}">${chips}</div>
      <textarea placeholder="Exercise note" data-ex-note="${index}" ${session.completed ? 'readonly' : ''}>${ex.exerciseNote || ''}</textarea>
      <div class="row-actions">
        <button type="button" class="btn btn-done ${ex.done ? 'on' : ''}" data-toggle-done="${index}" ${session.completed ? 'disabled' : ''}>
          ${ex.done ? '✓ Done' : 'Mark done'}
        </button>
      </div>
    </article>
  `
}

function bindToday(main) {
  main.querySelector('[data-goto-settings]')?.addEventListener('click', () => {
    view = 'settings'
    render()
  })

  main.querySelector('#finish-rest')?.addEventListener('click', () => openFinishModal(true))
  main.querySelector('#open-finish')?.addEventListener('click', () => openFinishModal(false))
  main.querySelector('#reopen-edit')?.addEventListener('click', () => {
    session.completed = false
    persistDraft()
    render()
  })

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
}

function openFinishModal(isRest) {
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>${isRest ? 'Log rest day' : 'Finish workout'}</h2>
      <p class="hint">Saved locally${drive.isSignedIn() ? ' and synced to Drive' : ''}.</p>
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
        <textarea id="session-note" placeholder="How did it feel overall?">${session.sessionNote || ''}</textarea>
      </div>
      <button type="button" class="btn btn-primary" id="confirm-finish">Save day</button>
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
      await finishDay()
      backdrop.remove()
      toast(drive.isSignedIn() ? 'Saved + synced to Drive' : 'Saved on this device')
      render()
    } catch (err) {
      console.error(err)
      toast(`Saved locally. Drive sync failed: ${err.message}`)
      backdrop.remove()
      render()
    }
  })
}

function buildLogPayload() {
  return {
    date: session.date,
    timezone: TZ,
    dayFocus: session.dayFocus,
    completed: true,
    overallFeeling: session.overallFeeling,
    sessionNote: session.sessionNote || '',
    exercises: session.exercises.map((ex) => ({
      name: ex.name,
      planned: {
        sets: ex.planned.sets,
        reps: ex.planned.reps,
        note: ex.planned.note || '',
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
    })),
    updatedAt: getZurichIsoNow(),
  }
}

async function finishDay() {
  const log = buildLogPayload()
  saveLog(session.date, log)
  clearDraft(session.date)
  session.completed = true
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
            ? 'Connected. Plan loads on open; logs upload on Finish day.'
            : 'Client ID found. Sign in to sync plan.json and workout logs.'
          : 'No VITE_GOOGLE_CLIENT_ID — app works offline with localStorage. Create an OAuth Web client in Google Cloud to enable sync.'
      }</p>
      ${
        drive.isConfigured()
          ? drive.isSignedIn()
            ? `<button type="button" class="btn btn-secondary" id="drive-disconnect" style="margin-top:10px">Disconnect</button>
               <button type="button" class="btn btn-primary" id="drive-refresh-plan" style="margin-top:8px">Refresh plan from Drive</button>`
            : `<button type="button" class="btn btn-primary" id="drive-connect" style="margin-top:10px">Connect Google Drive</button>`
          : `<p style="margin-top:8px">See README for OAuth setup. Put the client ID in <code>.env</code> as <code>VITE_GOOGLE_CLIENT_ID=...</code> then rebuild.</p>`
      }
    </div>

    <div class="card settings-block">
      <h3>Folder IDs</h3>
      <p>Fitness Coach<br/><code>${ids.fitnessCoach || '—'}</code></p>
      <p style="margin-top:8px">logs/<br/><code>${ids.logs || '—'}</code></p>
      <p style="margin-top:8px">plan.json<br/><code>${ids.plan || '—'}</code></p>
      <button type="button" class="btn btn-ghost" id="reset-folder-ids" style="margin-top:8px">Reset to defaults</button>
    </div>

    <div class="card settings-block">
      <h3>About</h3>
      <p>Strength plan · intermediate · full gym · Europe/Zurich.</p>
      <p style="margin-top:6px">Plan version: ${plan.planVersion ?? 1}</p>
      <p style="margin-top:6px">Add to Home Screen from your browser share menu for a PWA feel.</p>
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
      // Force session rebuild of displayed weights — keep kg internally
      render()
      toast(`Units: ${settings.unit}`)
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
      console.error(err)
      toast(err.message || 'Sign-in failed')
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
      toast(err.message || 'Refresh failed')
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
  const { plan: remote, folderIds } = await drive.fetchPlanFromDrive(settings)
  plan = remote
  savePlanLocal(plan)
  settings.folderIds = { ...settings.folderIds, ...folderIds }
  if (remote.unit === 'kg' || remote.unit === 'lb') {
    settings.unit = remote.unit
  }
  saveSettings(settings)
  // Rebuild today's session if not completed
  const dateStr = getZurichDateString()
  if (!loadLog(dateStr)?.completed) {
    session = buildSessionFromPlan(todayPlanDay(), dateStr)
  }
  if (force) toast('Loaded plan.json from Drive')
}

async function boot() {
  savePlanLocal(plan)
  if (!settings.unit && plan.unit) settings.unit = plan.unit
  saveSettings(settings)

  render()

  if (drive.isConfigured()) {
    try {
      await drive.initGoogle()
      // Auto prompt only if previously connected
      if (settings.driveConnected) {
        try {
          await drive.signIn()
          await refreshPlanFromDrive(false)
          render()
        } catch {
          // user dismissed or token issue
        }
      }
    } catch (err) {
      console.warn('Google init failed', err)
    }
  }

}

boot()
