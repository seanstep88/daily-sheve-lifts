// FitStep Application Logic

// 🚧 UNDER CONSTRUCTION FLAG — set to true while actively building, false to go live
const UNDER_CONSTRUCTION = false;

const STORAGE_KEY = 'fitstep_daily_workout';
const PROGRESS_KEY = 'fitstep_progress_state_v2';
const WEIGHTS_KEY = 'fitstep_weights_v1';
// 📬 Cloudflare Worker proxy URL — paste your worker URL here after deploying
const WORKER_URL = 'https://daily-sheve-lifts.sean-stepanek08.workers.dev';

// Known workout dates — update this list when new workouts/YYYY-MM-DD.json files are added
const WORKOUT_DATES = [
  '2026-09-08',
  '2026-09-09',
  '2026-09-12',
];

// State
let workoutData = null;
// completedSets stores keys like "exIndex-setIndex" e.g., "0-1", "0-2"
let completedSets = new Set();
// Track which cards have their GIF open
let expandedGifs = new Set();
let timerInterval = null;
let remainingSeconds = 0;

// Exercise Library
let exerciseIndex = {}; // { [name]: { mediaUrl, muscleGroup, unit } }
let cachedPrData = {}; // most-recently-fetched PR data — used by ℹ️ button
let newlyUnlocked = new Set();
const LIBRARY_SEEN_KEY = 'fitstep_library_seen_v1';

const MUSCLE_GROUPS = [
  { key: 'Chest',     label: '💪 Chest' },
  { key: 'Back',      label: '🔙 Back' },
  { key: 'Legs',      label: '🦵 Legs' },
  { key: 'Shoulders', label: '🏋️ Shoulders' },
  { key: 'Triceps',   label: '💥 Triceps' },
  { key: 'Biceps',    label: '🦾 Biceps' },
  { key: 'Core',      label: '🧘 Core' },
];

// Elements
const viewMode = document.getElementById('viewMode');
const editMode = document.getElementById('editMode');
const calendarView = document.getElementById('calendarView');
const libraryView = document.getElementById('libraryView');
const pastWorkoutView = document.getElementById('pastWorkoutView');
const homeView = document.getElementById('homeView');
const celebrationView = document.getElementById('celebrationView');
const toggleEditBtn = document.getElementById('toggleEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveAndApplyBtn = document.getElementById('saveAndApplyBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const resetProgressBtn = document.getElementById('resetProgressBtn');
const resetDataBtn = document.getElementById('resetDataBtn');
const importJsonFileInput = document.getElementById('importJsonFileInput');

// View Elements
const viewDate = document.getElementById('viewDate');
const viewSets = document.getElementById('viewSets');
const viewTitle = document.getElementById('viewTitle');
const viewNotes = document.getElementById('viewNotes');
const exercisesList = document.getElementById('exercisesList');
const progressBarEl = document.getElementById('progressBar');

// Edit Form Inputs
const editDate = document.getElementById('editDate');
const editSets = document.getElementById('editSets');
const editTitle = document.getElementById('editTitle');
const editNotes = document.getElementById('editNotes');
const editorExercisesList = document.getElementById('editorExercisesList');

// Timer Elements
const restTimerOverlay = document.getElementById('restTimerOverlay');
const timerDigits = document.getElementById('timerDigits');
const stopTimerBtn = document.getElementById('stopTimerBtn');
const add15SecBtn = document.getElementById('add15SecBtn');

// Calendar State
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Build exercise index regardless of construction mode (library is always available)
  buildExerciseIndex();

  // Pre-fetch PR data so the ℹ️ modal shows PRs without needing to open the library first
  fetchSummary().then(json => {
    if (json) cachedPrData = json.personalRecords || {};
  }).catch(() => {});

  if (UNDER_CONSTRUCTION) {
    document.getElementById('underConstruction').classList.remove('hidden');
    document.getElementById('viewMode').classList.add('hidden');
    // Still allow calendar browsing of past workouts
    setupEventListeners();
    return;
  }
  loadProgress();
  await loadWorkoutData();
  renderWorkoutView();
  setupEventListeners();

  // Show home page first
  viewMode.classList.add('hidden');
  homeView.classList.remove('hidden');
});

// 1. Data Fetching / Storage
async function loadWorkoutData() {
  // 1. Check if user saved an edit locally in this browser session
  const localSaved = localStorage.getItem(STORAGE_KEY);
  if (localSaved) {
    try {
      workoutData = JSON.parse(localSaved);
      return;
    } catch (e) {
      console.warn('Failed to parse localStorage data:', e);
    }
  }

  // 2. Try fetching workout.json
  try {
    const res = await fetch('./workout.json?t=' + Date.now());
    if (res.ok) {
      workoutData = await res.json();
      return;
    }
  } catch (err) {
    console.log('Using default bundled workout');
  }

  // 3. Fallback to default workout with live GIFs
  workoutData = getDefaultWorkout();
}

function getDefaultWorkout() {
  return {
    date: "Today's Workout",
    title: "Full Body Power & Core",
    totalSets: "3-4 Sets",
    notes: "Rest 60-90s between sets. Focus on slow, controlled eccentric reps.",
    exercises: [
      {
        name: "Bodyweight Squats",
        target: "3 Sets × 15 Reps",
        restSeconds: 60,
        mediaUrl: "https://media.giphy.com/media/1qgIPm9bmOhRjANGGF/giphy.gif",
        instructions: "Keep chest proud, feet shoulder-width apart, and squat down until thighs are parallel to the floor."
      },
      {
        name: "Push-Ups",
        target: "3 Sets × 12-15 Reps",
        restSeconds: 60,
        mediaUrl: "https://media.giphy.com/media/WDn21GO1KmpNK/giphy.gif",
        instructions: "Hands slightly wider than shoulder-width. Lower until chest nearly touches floor, keep core tight."
      },
      {
        name: "Dumbbell Bent-Over Row",
        target: "3 Sets × 10-12 Reps",
        restSeconds: 45,
        mediaUrl: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif",
        instructions: "Hinge at hips with flat back. Pull towards hip pocket, squeezing shoulder blades together."
      },
      {
        name: "Plank Hold",
        target: "3 Sets × 45 Seconds",
        restSeconds: 45,
        mediaUrl: "https://media.giphy.com/media/xT8qBff8cRRFf7k2u4/giphy.gif",
        instructions: "Hold rigid plank on forearms. Squeeze glutes and core tight without sagging lower back."
      }
    ]
  };
}

// Helper to extract total setCount from banner or exercise target
function getSetCount(setsStr, targetStr) {
  // Check exercise-specific target first if it has "X Sets" e.g. "4 Sets" or "3 Sets x 10 Reps"
  if (targetStr) {
    const m = targetStr.match(/(\d+)\s*sets?/i);
    if (m && m[1]) return parseInt(m[1], 10);
  }

  // Fallback to top banner totalSets e.g., "3-4 Sets", "4 Sets", "4 Rounds", "5"
  if (setsStr) {
    const rangeMatch = setsStr.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch && rangeMatch[2]) return parseInt(rangeMatch[2], 10);
    const singleMatch = setsStr.match(/(\d+)/);
    if (singleMatch && singleMatch[1]) return parseInt(singleMatch[1], 10);
  }

  return 3; // Default 3 sets
}

// Estimate total workout duration in minutes
function estimateWorkoutDuration(exercises, totalSetsStr) {
  const SEC_PER_REP = 3;       // ~3 seconds per rep
  const WARMUP_MIN = 3;        // fixed warmup buffer
  const BUFFER_MIN = 5;        // general water/misc buffer
  const SEC_PER_EXERCISE = 90; // transition time between exercises (setup, adjust machine, etc.)
  let totalSeconds = 0;

  exercises.forEach(ex => {
    const sets = getSetCount(totalSetsStr, ex.target);
    const reps = parseRepCount(ex.target); // reuse existing helper
    const rest = ex.restSeconds || 60;
    const isTime = ex.unit === 'time';
    // For time exercises use 45s of work per set; for reps use reps × SEC_PER_REP
    const workPerSet = isTime ? 45 : reps * SEC_PER_REP;
    totalSeconds += sets * (workPerSet + rest) + SEC_PER_EXERCISE;
  });

  const totalMin = Math.round(totalSeconds / 60) + WARMUP_MIN + BUFFER_MIN - 15;
  return totalMin;
}

// 2. Render Workout View
function renderWorkoutView() {
  if (!workoutData) return;

  viewDate.textContent = workoutData.date || "Today's Workout";
  viewSets.textContent = workoutData.totalSets || "3-4 Sets";
  viewTitle.textContent = workoutData.title || "Daily Routine";

  const durEl = document.getElementById('viewDuration');
  if (durEl) {
    const mins = estimateWorkoutDuration(workoutData.exercises || [], workoutData.totalSets || '3 Sets');
    durEl.textContent = `~${mins} min`;
  }
  
  if (workoutData.notes && workoutData.notes.trim()) {
    viewNotes.textContent = workoutData.notes;
    viewNotes.classList.remove('hidden');
  } else {
    viewNotes.classList.add('hidden');
  }

  exercisesList.innerHTML = '';

  const exercises = workoutData.exercises || [];
  const bannerSets = workoutData.totalSets || "3 Sets";

  exercises.forEach((ex, exIdx) => {
    const setCount = getSetCount(bannerSets, ex.target);
    
    // Check how many sets for this exercise are done
    let doneSetsForEx = 0;
    for (let s = 1; s <= setCount; s++) {
      if (completedSets.has(`${exIdx}-${s}`)) {
        doneSetsForEx++;
      }
    }
    const isExerciseFullyDone = (doneSetsForEx === setCount && setCount > 0);

    const card = document.createElement('article');
    card.className = `exercise-card ${isExerciseFullyDone ? 'completed' : ''}`;
    card.id = `exercise-card-${exIdx}`;

    const isExpanded = expandedGifs.has(exIdx);

    let mediaHtml = `<div class="media-fallback"><span class="fallback-icon">🏋️</span><span>No image/GIF added</span></div>`;
    const url = ex.mediaUrl ? ex.mediaUrl.trim() : '';

    if (url) {
      if (url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('video')) {
        mediaHtml = `<video src="${escapeHtml(url)}" class="exercise-media" autoplay loop muted playsinline></video>`;
      } else {
        mediaHtml = `<img src="${escapeHtml(url)}" alt="${escapeHtml(ex.name)}" class="exercise-media" loading="lazy" onerror="console.warn('Image failed to load:', this.src); this.parentElement.innerHTML='<div class=\'media-fallback\'><span class=\'fallback-icon\'>🏋️</span><span>Image link blocked or invalid</span><small style=\'color:var(--text-muted);font-size:0.75rem;word-break:break-all;margin-top:4px;\'>' + escapeHtml(this.src) + '</small></div>';">`;
      }
    }

    const restBtnHtml = ex.restSeconds && Number(ex.restSeconds) > 0
      ? `<button class="rest-badge-btn" onclick="startRestTimer(${ex.restSeconds})">⏱️ ${ex.restSeconds}s Rest</button>`
      : '';

    // Generate combined set rows: checkbox + weight input side by side
    let setRowsHtml = '';
    for (let s = 1; s <= setCount; s++) {
      const setKey = `${exIdx}-${s}`;
      const isSetDone = completedSets.has(setKey);
      setRowsHtml += `
        <div class="set-row ${isSetDone ? 'done' : ''}">
          <label class="set-row-check">
            <input type="checkbox" ${isSetDone ? 'checked' : ''} onchange="toggleSetDone(${exIdx}, ${s})">
            <span class="set-row-label">Set ${s}</span>
          </label>
          ${ex.unit === 'time'
            ? `<span class="time-input-group">
                <input type="number" class="time-part" min="0" max="99" maxlength="2" placeholder="0"
                  inputmode="numeric"
                  data-ex-idx="${exIdx}" data-set-idx="${s}" data-part="min"
                  onkeydown="blockNonNumeric(event)"
                  oninput="clampTimePart(this,99); onTimePartInput(this)" onblur="onTimePartBlur(${exIdx}, ${s})">
                <span class="time-colon">:</span>
                <input type="number" class="time-part" min="0" max="59" maxlength="2" placeholder="00"
                  inputmode="numeric"
                  data-ex-idx="${exIdx}" data-set-idx="${s}" data-part="sec"
                  onkeydown="blockNonNumeric(event)"
                  oninput="clampTimePart(this,59); onTimePartInput(this)" onblur="onTimePartBlur(${exIdx}, ${s})">
              </span>
              <input type="hidden"
                class="weight-input"
                data-ex-idx="${exIdx}"
                data-set-idx="${s}"
                data-unit="time">`
            : `<input
            type="number"
            class="weight-input"
            inputmode="decimal"
            placeholder="lb"
            data-ex-idx="${exIdx}"
            data-set-idx="${s}"
            data-unit="lbs"
            onkeydown="blockNonNumeric(event, true)"
            oninput="onWeightInput(this)"
            onblur="onWeightBlur(${exIdx}, ${s}, this.value, this)"
          >`}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="exercise-title-group">
          <span class="exercise-index">${exIdx + 1}</span>
          <h2 class="exercise-name" title="${escapeHtml(ex.name)}">${escapeHtml(ex.name)}</h2>
        </div>
        <button type="button" class="card-info-btn" data-ex-name="${escapeHtml(ex.name)}" aria-label="Exercise info">ℹ️</button>
      </div>

      <!-- 1. Exercise Details & Checkboxes Above GIF -->
      <div class="card-body">
        <div class="badge-row">
          <span class="target-badge">🎯 ${escapeHtml(ex.target || `${setCount} Sets × 10 Reps`)}</span>
          ${restBtnHtml}
        </div>

        <div class="sets-tracker">
          <div class="sets-tracker-title">
            <span>Sets Completed</span>
            <span>${doneSetsForEx}/${setCount} Done</span>
          </div>
          <div class="set-rows-group">
            ${setRowsHtml}
          </div>
        </div>

        ${ex.instructions ? `<div class="instructions-box">${escapeHtml(ex.instructions)}</div>` : ''}
      </div>

      <!-- 2. Expandable GIF Section (Hidden by Default) -->
      <div id="media-box-${exIdx}" class="media-container ${isExpanded ? '' : 'collapsed'}">
        ${mediaHtml}
      </div>

      <!-- 3. Bottom Expand / Collapse Button -->
      <div class="card-footer-toggle">
        <button type="button" class="toggle-media-btn ${isExpanded ? 'active' : ''}" onclick="toggleGifVisibility(${exIdx})">
          <span>${isExpanded ? '🙈 Hide Exercise Form' : '👀 Show Exercise Form / GIF'}</span>
        </button>
      </div>
    `;

    // Wire ℹ️ button → library detail modal
    const infoBtn = card.querySelector('.card-info-btn');
    if (infoBtn) {
      infoBtn.addEventListener('click', () => {
        const name = infoBtn.dataset.exName;
        const info = exerciseIndex[name];
        if (!info) return;
        const pr = cachedPrData[name] || { weight: '—', date: null };
        openExerciseDetail({ name, info, pr });
      });
    }

    exercisesList.appendChild(card);
  });

  updateProgressDisplay();
  const hadSavedWeights = loadWeightsIntoDOM();
  if (!hadSavedWeights) {
    autoFillLastWeights();
  }
}

// Toggle GIF collapse/expand state for discreet gym viewing
window.toggleGifVisibility = function(exIdx) {
  if (expandedGifs.has(exIdx)) {
    expandedGifs.delete(exIdx);
  } else {
    expandedGifs.add(exIdx);
  }
  renderWorkoutView();
};

// 3. Set Completion Tracker
window.toggleSetDone = function(exIdx, setNum) {
  const setKey = `${exIdx}-${setNum}`;
  if (completedSets.has(setKey)) {
    completedSets.delete(setKey);
  } else {
    completedSets.add(setKey);
  }
  saveProgress();
  renderWorkoutView();
};

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(completedSets)));
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      completedSets = new Set(JSON.parse(saved));
    }
  } catch(e) {
    completedSets = new Set();
  }
}

// Block non-numeric keys. allowDecimal=true permits '.' for lbs fields.
window.blockNonNumeric = function(e, allowDecimal = false) {
  const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Enter'];
  if (allowed.includes(e.key)) return;
  if (allowDecimal && e.key === '.') return;
  if (e.key >= '0' && e.key <= '9') return;
  e.preventDefault();
};

// Clamp a number input to max digits and a ceiling value immediately on input.
window.clampTimePart = function(el, maxVal) {
  if (el.value === '') return;
  // Strip beyond 2 digits
  if (el.value.length > 2) el.value = el.value.slice(0, 2);
  const n = parseInt(el.value, 10);
  if (!isNaN(n) && n > maxVal) el.value = maxVal;
};

// Weight tracking
function getWeightStorageKey() {
  return `${WEIGHTS_KEY}_${workoutData ? (workoutData.date || 'default') : 'default'}`;
}

window.onWeightInput = function(el) {
  if (el) el.classList.remove('weight-input--autofill');
  saveWeights();
};

window.onWeightBlur = function(exIdx, setIdx, value, el) {
  if (el) el.classList.remove('weight-input--autofill');
  // Auto-fill remaining empty sets only when user finishes typing (on blur)
  if (setIdx === 1 && value !== '') {
    const allInputs = document.querySelectorAll(`.weight-input[data-ex-idx="${exIdx}"]`);
    allInputs.forEach(input => {
      if (parseInt(input.dataset.setIdx) > 1 && input.value === '') {
        input.value = value;
        input.classList.remove('weight-input--autofill');
      }
    });
    saveWeights();
  }
};

// Sync the two time-part inputs (min + sec) into the hidden .weight-input and auto-fill sets
window.onTimePartInput = function(el) {
  const exIdx = el.dataset.exIdx;
  const setIdx = el.dataset.setIdx;
  const minEl = document.querySelector(`.time-part[data-ex-idx="${exIdx}"][data-set-idx="${setIdx}"][data-part="min"]`);
  const secEl = document.querySelector(`.time-part[data-ex-idx="${exIdx}"][data-set-idx="${setIdx}"][data-part="sec"]`);
  const combined = `${minEl.value || '0'}:${String(secEl.value || '0').padStart(2, '0')}`;
  const hidden = document.querySelector(`.weight-input[data-ex-idx="${exIdx}"][data-set-idx="${setIdx}"]`);
  if (hidden) hidden.value = combined;
  saveWeights();
};

window.onTimePartBlur = function(exIdx, setIdx) {
  const hidden = document.querySelector(`.weight-input[data-ex-idx="${exIdx}"][data-set-idx="${setIdx}"]`);
  const value = hidden ? hidden.value : '';
  if (setIdx === 1 && value && value !== '0:00') {
    // Auto-fill remaining empty sets
    const allHidden = document.querySelectorAll(`.weight-input[data-ex-idx="${exIdx}"][data-unit="time"]`);
    allHidden.forEach(h => {
      if (parseInt(h.dataset.setIdx) > 1 && !h.value) {
        h.value = value;
        // Also populate the visible min/sec fields
        const [m, sc] = value.split(':');
        const mEl = document.querySelector(`.time-part[data-ex-idx="${exIdx}"][data-set-idx="${h.dataset.setIdx}"][data-part="min"]`);
        const sEl = document.querySelector(`.time-part[data-ex-idx="${exIdx}"][data-set-idx="${h.dataset.setIdx}"][data-part="sec"]`);
        if (mEl) mEl.value = m;
        if (sEl) sEl.value = sc;
      }
    });
    saveWeights();
  }
};

function saveWeights() {
  if (!workoutData) return;
  const key = getWeightStorageKey();
  const data = {};
  document.querySelectorAll('.weight-input').forEach(input => {
    const exIdx = input.dataset.exIdx;
    const setIdx = input.dataset.setIdx;
    if (!data[exIdx]) data[exIdx] = {};
    data[exIdx][setIdx] = input.value;
  });
  localStorage.setItem(key, JSON.stringify(data));
}

// Returns true if any saved weights were loaded (used to decide whether to auto-fill)
function loadWeightsIntoDOM() {
  if (!workoutData) return false;
  const key = getWeightStorageKey();
  const saved = localStorage.getItem(key);
  if (!saved) return false;
  let found = false;
  try {
    const data = JSON.parse(saved);
    Object.entries(data).forEach(([exIdx, sets]) => {
      Object.entries(sets).forEach(([setIdx, value]) => {
        if (!value) return;
        const input = document.querySelector(`.weight-input[data-ex-idx="${exIdx}"][data-set-idx="${setIdx}"]`);
        if (input) {
          input.value = value;
          found = true;
          // If this is a time field, also restore the visible min/sec inputs
          if (input.dataset.unit === 'time' && value.includes(':')) {
            const [m, sc] = value.split(':');
            const mEl = document.querySelector(`.time-part[data-ex-idx="${exIdx}"][data-set-idx="${setIdx}"][data-part="min"]`);
            const sEl = document.querySelector(`.time-part[data-ex-idx="${exIdx}"][data-set-idx="${setIdx}"][data-part="sec"]`);
            if (mEl) mEl.value = m;
            if (sEl) sEl.value = sc;
          }
        }
      });
    });
  } catch (e) { /* ignore */ }
  return found;
}

function compileWeightSummary() {
  const title = workoutData?.title || 'Workout';
  const date = workoutData?.date || new Date().toLocaleDateString();
  const exercises = workoutData?.exercises || [];
  const bannerSets = workoutData?.totalSets || '3 Sets';

  const exerciseData = exercises.map((ex, exIdx) => {
    const setCount = getSetCount(bannerSets, ex.target);
    const sets = [];
    for (let s = 1; s <= setCount; s++) {
      const input = document.querySelector(`.weight-input[data-ex-idx="${exIdx}"][data-set-idx="${s}"]`);
      sets.push({ set: s, weight: input ? (input.value || '') : '' });
    }
    return { name: ex.name, sets };
  });

  // Use the workout's own isoDate so logs are filed under the workout's date,
  // not today's date (important when testing or loading past workouts).
  const logDate = workoutData?.isoDate || new Date().toLocaleDateString('en-CA');
  return JSON.stringify({ title, date: logDate, exercises: exerciseData }, null, 2);
}

async function sendWeightsToGist() {
  const date = workoutData?.isoDate || new Date().toLocaleDateString('en-CA');
  const content = compileWeightSummary();

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, content }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${res.status}: ${json.error || 'unknown'}`);
  } catch (err) {
    console.error('sendWeightsToGist failed silently:', err);
  }
}

function updateProgressDisplay() {
  const exercises = workoutData?.exercises || [];
  const bannerSets = workoutData?.totalSets || "3 Sets";
  
  let totalSetsCount = 0;
  exercises.forEach((ex) => {
    totalSetsCount += getSetCount(bannerSets, ex.target);
  });

  const doneSetsCount = completedSets.size;

  // Restore sets completed text
  const completedCountEl = document.getElementById('completedCount');
  const totalExerciseCountEl = document.getElementById('totalExerciseCount');
  if (completedCountEl) completedCountEl.textContent = doneSetsCount;
  if (totalExerciseCountEl) totalExerciseCountEl.textContent = `${totalSetsCount} sets`;

  const pct = totalSetsCount > 0 ? Math.min(100, Math.round((doneSetsCount / totalSetsCount) * 100)) : 0;
  if (progressBarEl) progressBarEl.style.width = `${pct}%`;

  // Show Complete Workout button only when all sets are done
  const completeBtn = document.getElementById('completeWorkoutBtn');
  if (completeBtn) {
    const allDone = totalSetsCount > 0 && doneSetsCount >= totalSetsCount;
    completeBtn.classList.toggle('hidden', !allDone);
  }
}

// 4. Timer Feature
window.startRestTimer = function(seconds) {
  clearInterval(timerInterval);
  remainingSeconds = parseInt(seconds, 10) || 60;
  if (restTimerOverlay) {
    restTimerOverlay.classList.remove('hidden');
  }
  updateTimerDisplay();

  // Gentle audio chime via Web Audio API when finished
  timerInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      remainingSeconds = 0;
      updateTimerDisplay();
      playBeep();
      setTimeout(() => {
        if (restTimerOverlay) {
          restTimerOverlay.classList.add('hidden');
        }
      }, 2500);
    } else {
      updateTimerDisplay();
    }
  }, 1000);
};

window.stopRestTimer = function() {
  clearInterval(timerInterval);
  remainingSeconds = 0;
  if (restTimerOverlay) {
    restTimerOverlay.classList.add('hidden');
  }
};

window.add15SecondsToTimer = function() {
  remainingSeconds += 15;
  updateTimerDisplay();
};

window.resetWorkoutCheckmarks = function() {
  if (confirm('Reset today’s completed checkmarks?')) {
    completedSets.clear();
    saveProgress();
    renderWorkoutView();
  }
};

function updateTimerDisplay() {
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  timerDigits.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.log('Audio alert not supported on this device');
  }
}

// 6. Exercise Library

async function buildExerciseIndex() {
  const filesToFetch = [
    'workout.json',
    ...WORKOUT_DATES.map(d => `workouts/${d}.json`),
  ];
  for (const file of filesToFetch) {
    try {
      const res = await fetch(`${file}?t=${Date.now()}`);
      if (!res.ok) continue;
      const json = await res.json();
      (json.exercises || []).forEach(ex => {
        if (!ex.name || exerciseIndex[ex.name]) return; // first-seen wins
        exerciseIndex[ex.name] = {
          mediaUrl: ex.mediaUrl || '',
          muscleGroup: ex.muscleGroup || 'Core',
          unit: ex.unit || 'lbs',
          description: ex.description || '',
          weightNote: ex.weightNote || '',
        };
      });
    } catch (e) { /* ignore missing files */ }
  }
}

function computeNewlyUnlocked(prData) {
  const seen = JSON.parse(localStorage.getItem(LIBRARY_SEEN_KEY) || '[]');
  const seenSet = new Set(seen);
  newlyUnlocked = new Set();
  Object.keys(prData).forEach(name => {
    if (!seenSet.has(name)) newlyUnlocked.add(name);
  });
  // Save updated seen list
  const updated = Array.from(new Set([...seen, ...Object.keys(prData)]));
  localStorage.setItem(LIBRARY_SEEN_KEY, JSON.stringify(updated));
}

// Lookup map for exercise detail data — keyed by index, populated each renderLibrary call
const libraryCardData = {};

async function renderLibrary() {
  const content = document.getElementById('libraryContent');
  if (!content) return;
  content.innerHTML = '<p class="lib-loading">Loading…</p>';

  // Fetch PR data
  let prData = {};
  try {
    const json = await fetchSummary();
    if (json) {
      prData = json.personalRecords || {};
      cachedPrData = prData;
    }
  } catch (e) { /* offline — show what we can */ }

  computeNewlyUnlocked(prData);

  // Glow the trophy button if there are new unlocks
  const libraryBtn = document.getElementById('libraryBtn');
  if (libraryBtn) {
    libraryBtn.dataset.hasNew = newlyUnlocked.size > 0 ? 'true' : 'false';
  }

  let html = '';
  let cardIdx = 0;
  Object.keys(libraryCardData).forEach(k => delete libraryCardData[k]); // clear previous

  MUSCLE_GROUPS.forEach(({ key, label }) => {
    // Exercises in this group from the index
    const groupExercises = Object.entries(exerciseIndex)
      .filter(([, info]) => info.muscleGroup === key);

    if (groupExercises.length === 0) return;

    // Split into unlocked (has PR) and locked
    const unlocked = groupExercises.filter(([name]) => prData[name]);
    const locked   = groupExercises.filter(([name]) => !prData[name]);

    let cardsHtml = '';

    // Unlocked cards — tappable, opens detail modal
    unlocked.forEach(([name, info]) => {
      const pr = prData[name];
      const isNew = newlyUnlocked.has(name);
      const newBadge = isNew ? '<span class="unlock-badge">✨ Unlocked!</span>' : '';
      const prValue = info.unit === 'time' ? pr.weight : `${pr.weight} lbs`;
      const prDate  = pr.date ? `<span class="lib-pr-date">PR on ${pr.date}</span>` : '';

      let mediaHtml;
      const url = info.mediaUrl.trim();
      if (url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('video')) {
        mediaHtml = `<video class="lib-card-media" autoplay loop muted playsinline src="${escapeHtml(url)}"></video>`;
      } else if (url) {
        mediaHtml = `<img class="lib-card-media" src="${escapeHtml(url)}" alt="${escapeHtml(name)}" loading="lazy">`;
      } else {
        mediaHtml = `<div class="lib-card-media lib-no-media">🏋️</div>`;
      }

      libraryCardData[cardIdx] = { name, info, pr };
      cardsHtml += `
        <article class="lib-card unlocked" data-card-idx="${cardIdx++}">
          ${mediaHtml}
          <div class="lib-card-body">
            ${newBadge}
            <h3 class="lib-card-name">${escapeHtml(name)}</h3>
            <span class="lib-pr-badge">🏋️ ${prValue}</span>
            ${prDate}
          </div>
        </article>`;
    });

    // Mystery cards at end of each group (show all locked ones, max 3)
    const mysteryCount = Math.min(locked.length, 3);
    for (let i = 0; i < mysteryCount; i++) {
      cardsHtml += `
        <article class="lib-card mystery" onclick="shakeCard(this)">
          <div class="lib-card-media lib-mystery-icon">❓</div>
          <div class="lib-card-body">
            <h3 class="lib-card-name lib-mystery-name">???</h3>
            <span class="lib-pr-badge lib-mystery-badge">🔒 Locked</span>
          </div>
        </article>`;
    }

    if (!cardsHtml) return;

    html += `
      <details class="lib-group" open>
        <summary class="lib-group-header">${label}</summary>
        <div class="lib-card-grid">${cardsHtml}</div>
      </details>`;
  });

  content.innerHTML = html || '<p class="lib-empty">No exercises logged yet — complete a workout to unlock your first card!</p>';

  // Wire up card clicks via delegation (avoids inline onclick + encoding issues)
  content.querySelectorAll('.lib-card.unlocked[data-card-idx]').forEach(card => {
    card.addEventListener('click', () => {
      const idx = card.dataset.cardIdx;
      if (libraryCardData[idx]) openExerciseDetail(libraryCardData[idx]);
    });
  });
}

window.shakeCard = function(el) {
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 600);
};

window.openExerciseDetail = function(data) {
  const { name, info, pr } = data;
  const prValue = info.unit === 'time' ? pr.weight : `${pr.weight} lbs`;
  const prDate  = pr.date ? `<p class="ex-detail-pr-date">PR set on ${pr.date}</p>` : '';

  let mediaHtml;
  const url = (info.mediaUrl || '').trim();
  if (url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('video')) {
    mediaHtml = `<video class="ex-detail-media" autoplay loop muted playsinline src="${escapeHtml(url)}"></video>`;
  } else if (url) {
    mediaHtml = `<img class="ex-detail-media" src="${escapeHtml(url)}" alt="${escapeHtml(name)}" loading="lazy">`;
  } else {
    mediaHtml = `<div class="ex-detail-media ex-detail-no-media">🏋️</div>`;
  }

  const descHtml = info.description
    ? `<ol class="ex-detail-steps">${info.description.split('\n').map(step =>
        `<li>${escapeHtml(step.replace(/^\d+\.\s*/, ''))}</li>`).join('')}</ol>`
    : '';

  const weightNoteHtml = info.weightNote
    ? `<p class="weight-note">💡 ${escapeHtml(info.weightNote)}</p>`
    : '';

  document.getElementById('exerciseDetailContent').innerHTML = `
    ${mediaHtml}
    <div class="ex-detail-body">
      <h2 class="ex-detail-name">${escapeHtml(name)}</h2>
      <span class="ex-detail-group">${escapeHtml(info.muscleGroup || '')}</span>
      <div class="ex-detail-pr">
        <span class="lib-pr-badge">🏆 PR: ${prValue}</span>
        ${prDate}
      </div>
      ${weightNoteHtml}
      ${descHtml}
    </div>`;

  document.getElementById('exerciseDetailOverlay').classList.remove('hidden');
};

window.closeExerciseDetail = function() {
  document.getElementById('exerciseDetailOverlay').classList.add('hidden');
};

window.loadWorkoutByDate = async function(dateStr) {
  if (!dateStr) return;
  try {
    const res = await fetch(`workouts/${dateStr}.json?t=${Date.now()}`);
    if (!res.ok) return;
    workoutData = await res.json();
    workoutData.isoDate = dateStr; // derive from filename, no need in JSON
    completedSets.clear();
    saveProgress();
    renderWorkoutView();
    libraryView.classList.add('hidden');
    viewMode.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) { /* ignore */ }
};

// 5. Calendar Features
function renderCalendar(year, month) {
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent = `${monthNames[month]} ${year}`;

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // First day of month (0=Sun…6=Sat) and total days
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Blank cells before day 1
  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'calendar-day empty';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    cell.textContent = d;

    // Past/future workout days stay purple and tappable
    if (WORKOUT_DATES.includes(dateStr) && dateStr !== todayStr) {
      cell.classList.add('has-workout');
      cell.addEventListener('click', () => loadCalendarWorkout(dateStr));
    }

    // Today gets blue ring and is always tappable
    if (dateStr === todayStr) {
      cell.classList.add('today');
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => {
        if (UNDER_CONSTRUCTION) {
          calendarView.classList.add('hidden');
          document.getElementById('underConstruction').classList.remove('hidden');
        } else {
          loadCalendarWorkout(dateStr);
        }
      });
    }

    grid.appendChild(cell);
  }
}

async function loadCalendarWorkout(dateStr) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const isPast = dateStr < todayStr;

  try {
    // Past date — try to show read-only log recap first
    if (isPast) {
      const logRes = await fetch(`logs/${dateStr}.json?t=${Date.now()}`);
      if (logRes.ok) {
        const logData = await logRes.json();
        let workoutDef = null;
        try {
          const wRes = await fetch(`workouts/${dateStr}.json?t=${Date.now()}`);
          if (wRes.ok) workoutDef = await wRes.json();
        } catch (e) { /* no workout def */ }
        calendarView.classList.add('hidden');
        renderPastWorkout(dateStr, logData, workoutDef);
        return;
      }
    }

    // No log or today/future — try specific date file, fall back to workout.json
    let res = await fetch(`workouts/${dateStr}.json?t=${Date.now()}`);
    if (!res.ok) res = await fetch(`workout.json?t=${Date.now()}`);
    if (!res.ok) throw new Error('Not found');
    workoutData = await res.json();
    workoutData.isoDate = dateStr;
    completedSets.clear();
    saveProgress();
    renderWorkoutView();
    calendarView.classList.add('hidden');
    viewMode.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    alert(`Could not load workout for ${dateStr}.`);
  }
}

function renderPastWorkout(dateStr, logData, workoutDef) {
  // Build def map from workout definition file
  const defMap = {};
  (workoutDef?.exercises || []).forEach(ex => {
    defMap[ex.name] = ex;
  });

  // Header — use display date + rounds from workoutDef, fall back to logData
  const displayDate = workoutDef?.date || logData.date || dateStr;
  const totalSets = workoutDef?.totalSets || '';
  const notes = workoutDef?.notes || '';

  document.getElementById('pastWorkoutTitle').textContent = logData.title || workoutDef?.title || 'Workout';
  document.getElementById('pastWorkoutDate').textContent = displayDate;

  // Duration estimate using workoutDef exercises
  const durEl = document.getElementById('pastWorkoutDuration');
  if (durEl && workoutDef?.exercises) {
    const mins = estimateWorkoutDuration(workoutDef.exercises, totalSets);
    durEl.textContent = `~${mins} min`;
  } else if (durEl) {
    durEl.textContent = '';
  }
  const setsEl = document.getElementById('pastWorkoutSets');
  if (setsEl) setsEl.textContent = totalSets;

  const notesEl = document.getElementById('pastWorkoutNotes');
  if (notesEl) {
    notesEl.textContent = notes;
    notesEl.classList.toggle('hidden', !notes);
  }

  const content = document.getElementById('pastWorkoutContent');
  content.innerHTML = (logData.exercises || []).map((ex, i) => {
    const def = defMap[ex.name] || {};
    const url = (def.mediaUrl || '').trim();
    const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('video');
    let mediaEl = '';
    if (isVideo) {
      mediaEl = `<video class="exercise-media" autoplay loop muted playsinline src="${escapeHtml(url)}"></video>`;
    } else if (url) {
      mediaEl = `<img class="exercise-media" src="${escapeHtml(url)}" alt="${escapeHtml(ex.name)}" loading="lazy">`;
    }

    const setCount = ex.sets?.length || 0;
    const setsHtml = (ex.sets || []).map(s => {
      const val = s.weight && s.weight !== '0' ? s.weight : '—';
      const label = def.unit === 'time' ? val : (val === '—' ? '—' : `${val} lbs`);
      return `<div class="set-row done">
        <label class="set-row-check">
          <input type="checkbox" checked disabled>
          <span class="set-row-label">Set ${s.set}</span>
        </label>
        <span class="past-set-weight">${escapeHtml(label)}</span>
      </div>`;
    }).join('');

    return `<article class="exercise-card completed past-card">
      <div class="card-top">
        <div class="exercise-title-group">
          <span class="exercise-index">${i + 1}</span>
          <h2 class="exercise-name" title="${escapeHtml(ex.name)}">${escapeHtml(ex.name)}</h2>
        </div>
      </div>
      <div class="card-body">
        <div class="badge-row">
          <span class="target-badge">🎯 ${escapeHtml(def.target || '')}</span>
        </div>
        <div class="sets-tracker">
          <div class="sets-tracker-title">
            <span>Sets Completed</span>
            <span>${setCount}/${setCount} Done</span>
          </div>
          <div class="set-rows-group">${setsHtml}</div>
        </div>
        ${def.instructions ? `<div class="instructions-box">${escapeHtml(def.instructions)}</div>` : ''}
      </div>
      ${mediaEl ? `
      <div class="media-container collapsed" id="past-media-${i}">${mediaEl}</div>
      <div class="card-footer-toggle">
        <button type="button" class="toggle-media-btn" onclick="togglePastMedia(${i})">
          <span>👀 Show Exercise Form / GIF</span>
        </button>
      </div>` : ''}
    </article>`;
  }).join('');

  [viewMode, homeView, editMode, calendarView, libraryView, celebrationView].forEach(v => v?.classList.add('hidden'));
  document.getElementById('underConstruction').classList.add('hidden');
  pastWorkoutView.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.togglePastMedia = function(idx) {
  const box = document.getElementById(`past-media-${idx}`);
  const btn = box?.nextElementSibling?.querySelector('.toggle-media-btn');
  if (!box) return;
  const collapsed = box.classList.toggle('collapsed');
  if (btn) btn.innerHTML = `<span>${collapsed ? '👀 Show Exercise Form / GIF' : '🙈 Hide Exercise Form'}</span>`;
};

// 6. Editor Features
function openEditor() {
  editDate.value = workoutData.date || '';
  editSets.value = workoutData.totalSets || '';
  editTitle.value = workoutData.title || '';
  editNotes.value = workoutData.notes || '';

  renderEditorExerciseInputs(workoutData.exercises || []);

  viewMode.classList.add('hidden');
  editMode.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderEditorExerciseInputs(exercises) {
  editorExercisesList.innerHTML = '';
  exercises.forEach((ex, idx) => {
    const card = document.createElement('div');
    card.className = 'editor-item-card';
    card.dataset.index = idx;

    card.innerHTML = `
      <div class="item-card-header">
        <strong>Exercise #${idx + 1}</strong>
        <button type="button" class="delete-exercise-btn" onclick="removeEditorExercise(${idx})">🗑️ Delete</button>
      </div>

      <div class="form-group">
        <label>Exercise Name</label>
        <input type="text" class="input-ex-name" value="${escapeHtml(ex.name || '')}" placeholder="e.g., Incline Dumbbell Press">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Sets × Reps / Time</label>
          <input type="text" class="input-ex-target" value="${escapeHtml(ex.target || '')}" placeholder="e.g., 4 Sets × 10 Reps or 45s">
        </div>
        <div class="form-group">
          <label>Rest (seconds)</label>
          <input type="number" class="input-ex-rest" value="${ex.restSeconds !== undefined ? ex.restSeconds : 60}" placeholder="e.g., 60">
        </div>
      </div>

      <div class="form-group">
        <label>GIF, Video, or Image (URL, Local File, or Upload)</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" class="input-ex-media" value="${escapeHtml(ex.mediaUrl || '')}" placeholder="Paste any image/GIF link or ./images/squat.gif" style="flex:1;">
          <label class="btn-secondary" style="white-space:nowrap;padding:9px 12px;font-size:0.8rem;cursor:pointer;margin:0;" title="Choose file from your phone or computer">
            📁 Browse
            <input type="file" accept="image/*,video/*" style="display:none;" onchange="handleFileUpload(this, ${idx})">
          </label>
        </div>
      </div>

      <div class="form-group">
        <label>Form / Execution Instructions</label>
        <textarea class="input-ex-instructions" rows="2" placeholder="Cue: Chest up, tuck elbows at 45°">${escapeHtml(ex.instructions || '')}</textarea>
      </div>
    `;

    editorExercisesList.appendChild(card);
  });
}

window.removeEditorExercise = function(idx) {
  const current = collectFormData();
  current.exercises.splice(idx, 1);
  renderEditorExerciseInputs(current.exercises);
};

function normalizeMediaUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();

  // Clean wrapped quotes
  trimmed = trimmed.replace(/^["']|["']$/g, '');

  // 0. Unwrap Google redirect URLs: https://www.google.com/url?...&url=https%3A%2F%2Ftenor.com%2Fview...
  if (trimmed.includes('google.com/url') && (trimmed.includes('url=') || trimmed.includes('q='))) {
    try {
      const parsedUrl = new URL(trimmed);
      const extracted = parsedUrl.searchParams.get('url') || parsedUrl.searchParams.get('q');
      if (extracted) {
        trimmed = decodeURIComponent(extracted);
      }
    } catch (e) {
      // fallback regex if standard URL parser fails
      const m = trimmed.match(/[?&](?:url|q)=([^&]+)/);
      if (m && m[1]) {
        trimmed = decodeURIComponent(m[1]);
      }
    }
  }

  // 1. Giphy share URLs: https://giphy.com/gifs/squat-1qgIPm9bmOhRjANGGF
  const giphyMatch = trimmed.match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)/i);
  if (giphyMatch && giphyMatch[1] && !trimmed.includes('i.giphy.com') && !trimmed.includes('media.giphy.com')) {
    return `https://i.giphy.com/media/${giphyMatch[1]}/giphy.gif`;
  }

  // 2. Tenor share URLs: https://tenor.com/view/rope-push-down-gif-27382975 or https://tenor.com/view/xyz-gif-12345
  const tenorMatch = trimmed.match(/tenor\.com\/view\/.*?-([0-9]+)$/i);
  if (tenorMatch && tenorMatch[1]) {
    // Tenor static CDN pattern or direct media route
    return `https://c.tenor.com/${tenorMatch[1]}/tenor.gif`;
  }

  // 3. Imgur share links: https://imgur.com/gallery/xyz or https://imgur.com/xyz
  const imgurMatch = trimmed.match(/imgur\.com\/(?:gallery\/)?([a-zA-Z0-9]+)$/i);
  if (imgurMatch && imgurMatch[1] && !trimmed.includes('i.imgur.com')) {
    return `https://i.imgur.com/${imgurMatch[1]}.gif`;
  }

  return trimmed;
}

function collectFormData() {
  const exerciseCards = editorExercisesList.querySelectorAll('.editor-item-card');
  const exercises = [];

  exerciseCards.forEach(card => {
    const rawUrl = card.querySelector('.input-ex-media').value;
    exercises.push({
      name: card.querySelector('.input-ex-name').value.trim() || 'Untitled Exercise',
      target: card.querySelector('.input-ex-target').value.trim() || '3 Sets × 10 Reps',
      restSeconds: parseInt(card.querySelector('.input-ex-rest').value, 10) || 0,
      mediaUrl: normalizeMediaUrl(rawUrl),
      instructions: card.querySelector('.input-ex-instructions').value.trim()
    });
  });

  return {
    date: editDate.value.trim() || "Today's Workout",
    title: editTitle.value.trim() || "Daily Routine",
    totalSets: editSets.value.trim() || "3-4 Sets",
    notes: editNotes.value.trim(),
    exercises: exercises
  };
}

// 7. Celebration / Volume Helpers

// Extracts rep count from strings like "15 Reps", "8-10 Reps", "3 Sets × 10 Reps". Returns upper bound. Default 10.
function parseRepCount(targetStr) {
  if (!targetStr) return 10;
  // "8-10 Reps" → use 10
  const rangeMatch = targetStr.match(/(\d+)\s*[-–]\s*(\d+)\s*reps?/i);
  if (rangeMatch) return parseInt(rangeMatch[2], 10);
  // "15 Reps" or "× 15 Reps"
  const singleMatch = targetStr.match(/[×x]?\s*(\d+)\s*reps?/i);
  if (singleMatch) return parseInt(singleMatch[1], 10);
  return 10;
}

// Sums weight × reps across all sets/exercises from the current DOM.
// Dumbbell exercises (dumbbell:true) are doubled since Neve enters one dumbbell's weight
// but uses two (or does both arms) each set.
function calcTotalVolume() {
  if (!workoutData) return 0;
  const exercises = workoutData.exercises || [];
  const bannerSets = workoutData.totalSets || '3 Sets';
  let total = 0;
  exercises.forEach((ex, exIdx) => {
    const reps = parseRepCount(ex.target);
    const setCount = getSetCount(bannerSets, ex.target);
    const multiplier = ex.dumbbell ? 2 : 1;
    for (let s = 1; s <= setCount; s++) {
      const input = document.querySelector(`.weight-input[data-ex-idx="${exIdx}"][data-set-idx="${s}"]`);
      const w = input ? parseFloat(input.value) : 0;
      if (w > 0) total += w * reps * multiplier;
    }
  });
  return Math.round(total);
}

const WEIGHT_ITEMS = [
  { max: 300,   emoji: '🐑', text: 'about one Shawn' },
  { max: 700,   emoji: '🚒', text: 'a NYC fire hydrant' },
  { max: 1200,  emoji: '🎹', text: 'a baby grand piano' },
  { max: 2000,  emoji: '🐗🐗🐗', text: 'a sounder of wild boars (pigs who lift?)' },
  { max: 3500,  emoji: '🚕', text: 'a NYC yellow taxi cab' },
  { max: 6000,  emoji: '🚌', text: 'an MBTA 77 bus to Arlington' },
  { max: 10000, emoji: '🚜', text: 'a farm tractor' },
  { max: 18000, emoji: '🚡', text: 'an aerial tramway car' },
  { max: 30000, emoji: '🚛', text: 'a loaded semi-truck' },
  { max: 50000, emoji: '🚂', text: 'Big Boy (the train)' },
  { max: Infinity, emoji: '⛴️', text: 'a Staten Island Ferry' },
];

function getWeightItem(volumeLbs) {
  return WEIGHT_ITEMS.find(item => volumeLbs < item.max) || WEIGHT_ITEMS[WEIGHT_ITEMS.length - 1];
}

const SUMMARY_URL = 'https://raw.githubusercontent.com/seanstep88/daily-sheve-lifts/main/logs/summary.json';
const LOCAL_SUMMARY = 'logs/summary.json';

// Fetch summary.json — tries GitHub first, falls back to local copy.
// This lets the local dev server use the local file while production uses GitHub.
async function fetchSummary() {
  try {
    const res = await fetch(SUMMARY_URL + '?t=' + Date.now());
    if (res.ok) return res.json();
  } catch (e) { /* network unavailable or CORS — fall through */ }
  // Fallback: same-origin local file (works when running via local server)
  const res = await fetch(LOCAL_SUMMARY + '?t=' + Date.now());
  if (res.ok) return res.json();
  return null;
}

async function showCelebration() {
  // Fire send to GitHub (non-blocking)
  sendWeightsToGist();

  const volume = calcTotalVolume();
  const item = getWeightItem(volume);

  // Fetch PR data silently
  let prData = {};
  try {
    const json = await fetchSummary();
    if (json) {
      prData = json.personalRecords || {};
      cachedPrData = prData;
    }
  } catch (e) { /* ignore */ }

  // Build recap HTML
  const exercises = workoutData?.exercises || [];
  const bannerSets = workoutData?.totalSets || '3 Sets';
  let recapHtml = '';
  exercises.forEach((ex, exIdx) => {
    const setCount = getSetCount(bannerSets, ex.target);
    const weights = [];
    for (let s = 1; s <= setCount; s++) {
      const input = document.querySelector(`.weight-input[data-ex-idx="${exIdx}"][data-set-idx="${s}"]`);
      const w = input && input.value ? `${input.value} lb` : '—';
      weights.push(`Set ${s}: ${w}`);
    }
    // PR detection: find max weight used today for this exercise
    const todayMax = (() => {
      let max = 0;
      for (let s = 1; s <= setCount; s++) {
        const input = document.querySelector(`.weight-input[data-ex-idx="${exIdx}"][data-set-idx="${s}"]`);
        const w = input ? parseFloat(input.value) : 0;
        if (w > max) max = w;
      }
      return max;
    })();
    const pr = prData[ex.name];
    const isNewPR = todayMax > 0 && (!pr || todayMax > parseFloat(pr.weight));
    recapHtml += `
      <div class="celeb-recap-card">
        <div class="celeb-recap-name">${escapeHtml(ex.name)}${isNewPR ? ' <span class="celeb-pr-badge">🏆 PR!</span>' : ''}</div>
        <div class="celeb-recap-sets">${weights.join(' · ')}</div>
      </div>
    `;
  });

  // Populate DOM
  document.getElementById('celebTitle').textContent = "You're ripped, Neve 🐷";
  document.getElementById('celebVolume').innerHTML =
    volume > 0 ? `You lifted <strong>${volume.toLocaleString()} lbs</strong>` : 'Great job completing your workout!';
  document.getElementById('celebItemEmoji').textContent = item.emoji;
  document.getElementById('celebItemText').textContent =
    volume > 0 ? `That's the equivalent of ${item.text}!` : '';
  document.getElementById('celebRecap').innerHTML = recapHtml;

  // Switch views
  viewMode.classList.add('hidden');
  celebrationView.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Fire confetti
  launchConfetti();
}

// 8. Confetti Animation (pure canvas, no library)
let confettiAnimFrame = null;

function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#a78bfa', '#fb7185', '#fbbf24', '#38bdf8', '#ffffff'];
  const N = 120;
  const particles = Array.from({ length: N }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 60,
    size: 6 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    speedX: (Math.random() - 0.5) * 3,
    speedY: 2 + Math.random() * 4,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.2,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }));

  const startTime = performance.now();
  const FADE_START = 2500;
  const STOP_AT = 4000;

  if (confettiAnimFrame) cancelAnimationFrame(confettiAnimFrame);

  function animate(now) {
    const elapsed = now - startTime;
    if (elapsed >= STOP_AT) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.opacity = '1';
      return;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fade canvas after FADE_START ms
    if (elapsed > FADE_START) {
      canvas.style.opacity = String(1 - (elapsed - FADE_START) / (STOP_AT - FADE_START));
    }

    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotSpeed;
      // Wrap at bottom
      if (p.y > canvas.height + 20) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.9;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      ctx.restore();
    });

    confettiAnimFrame = requestAnimationFrame(animate);
  }

  canvas.style.opacity = '1';
  confettiAnimFrame = requestAnimationFrame(animate);
}

// 9. Auto-fill Last Weights
async function autoFillLastWeights() {
  if (!workoutData) return;
  try {
    const json = await fetchSummary();
    if (!json) return;
    const sessions = json.recentSessions || [];
    if (!sessions.length) return;

    // Build a map: exerciseName → most recent weights array
    const lastWeights = {};
    // sessions are most-recent-first; iterate to get the freshest data per exercise
    sessions.forEach(session => {
      (session.exercises || []).forEach(exData => {
        const name = exData.name;
        if (name && !lastWeights[name] && Array.isArray(exData.sets)) {
          // sets is [{set, weight}] or [w1, w2, ...]
          lastWeights[name] = exData.sets.map(s => (typeof s === 'object' ? s.weight : s));
        }
      });
    });

    const exercises = workoutData.exercises || [];
    const bannerSets = workoutData.totalSets || '3 Sets';

    exercises.forEach((ex, exIdx) => {
      const prev = lastWeights[ex.name];
      if (!prev || !prev.length) return;
      const setCount = getSetCount(bannerSets, ex.target);
      for (let s = 1; s <= setCount; s++) {
        const input = document.querySelector(`.weight-input[data-ex-idx="${exIdx}"][data-set-idx="${s}"]`);
        if (!input || input.value) continue; // don't overwrite user-entered values
        const w = prev[s - 1] || prev[0]; // use matching set or fallback to set 1
        if (w) {
          input.value = w;
          input.classList.add('weight-input--autofill');
        }
      }
    });
  } catch (e) { /* silently skip if network unavailable */ }
}

// 6. Event Listeners
function setupEventListeners() {
  if (toggleEditBtn) toggleEditBtn.addEventListener('click', openEditor);
  
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => {
    editMode.classList.add('hidden');
    viewMode.classList.remove('hidden');
  });

  addExerciseBtn.addEventListener('click', () => {
    const current = collectFormData();
    current.exercises.push({
      name: "",
      target: "3 Sets × 10-12 Reps",
      restSeconds: 60,
      mediaUrl: "",
      instructions: ""
    });
    renderEditorExerciseInputs(current.exercises);
  });

  if (saveAndApplyBtn) saveAndApplyBtn.addEventListener('click', () => {
    workoutData = collectFormData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    completedSets.clear();
    saveProgress();
    
    editMode.classList.add('hidden');
    viewMode.classList.remove('hidden');
    renderWorkoutView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Reset to default sample workout
  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
      if (confirm('Reset to the fresh workout with sample GIFs?')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PROGRESS_KEY);
        completedSets.clear();
        saveProgress();
        workoutData = getDefaultWorkout();
        renderWorkoutView();
      }
    });
  }

  // Import JSON file directly (e.g. from Downloads)
  if (importJsonFileInput) {
    importJsonFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed && parsed.exercises) {
            workoutData = parsed;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
            renderEditorExerciseInputs(workoutData.exercises || []);
            editDate.value = workoutData.date || '';
            editSets.value = workoutData.totalSets || '';
            editTitle.value = workoutData.title || '';
            editNotes.value = workoutData.notes || '';
            alert('Workout imported successfully! Click "Save & Preview Live" to view.');
          } else {
            alert('Invalid workout JSON format.');
          }
        } catch (err) {
          alert('Could not parse JSON file.');
        }
      };
      reader.readAsText(file);
    });
  }

  if (downloadJsonBtn) downloadJsonBtn.addEventListener('click', () => {
    const updatedData = collectFormData();
    const jsonStr = JSON.stringify(updatedData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workout.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  resetProgressBtn.addEventListener('click', () => {
    if (confirm('Reset today’s completed checkmarks?')) {
      completedSets.clear();
      saveProgress();
      renderWorkoutView();
    }
  });

  stopTimerBtn.addEventListener('click', () => {
    clearInterval(timerInterval);
    restTimerOverlay.classList.add('hidden');
  });

  add15SecBtn.addEventListener('click', () => {
    remainingSeconds += 15;
    updateTimerDisplay();
  });

  // Calendar button — open calendar
  const calendarBtn = document.getElementById('calendarBtn');
  if (calendarBtn) {
    calendarBtn.addEventListener('click', () => {
      calYear = new Date().getFullYear();
      calMonth = new Date().getMonth();
      renderCalendar(calYear, calMonth);
      viewMode.classList.add('hidden');
      homeView.classList.add('hidden');
      editMode.classList.add('hidden');
      libraryView.classList.add('hidden');
      pastWorkoutView.classList.add('hidden');
      document.getElementById('celebrationView').classList.add('hidden');
      document.getElementById('underConstruction').classList.add('hidden');
      calendarView.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Calendar close — return to view mode
  const calendarCloseBtn = document.getElementById('calendarCloseBtn');
  if (calendarCloseBtn) {
    calendarCloseBtn.addEventListener('click', () => {
      calendarView.classList.add('hidden');
      if (UNDER_CONSTRUCTION) {
        document.getElementById('underConstruction').classList.remove('hidden');
      } else {
        viewMode.classList.remove('hidden');
      }
    });
  }

  // Library button — open exercise library
  const libraryBtn = document.getElementById('libraryBtn');
  if (libraryBtn) {
    libraryBtn.addEventListener('click', () => {
      viewMode.classList.add('hidden');
      homeView.classList.add('hidden');
      editMode.classList.add('hidden');
      calendarView.classList.add('hidden');
      pastWorkoutView.classList.add('hidden');
      document.getElementById('celebrationView').classList.add('hidden');
      document.getElementById('underConstruction').classList.add('hidden');
      libraryView.classList.remove('hidden');
      renderLibrary();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Library close — return to previous view
  const libraryCloseBtn = document.getElementById('libraryCloseBtn');
  if (libraryCloseBtn) {
    libraryCloseBtn.addEventListener('click', () => {
      libraryView.classList.add('hidden');
      if (UNDER_CONSTRUCTION) {
        document.getElementById('underConstruction').classList.remove('hidden');
      } else {
        viewMode.classList.remove('hidden');
      }
    });
  }

  // Past workout close — return to calendar
  const pastWorkoutCloseBtn = document.getElementById('pastWorkoutCloseBtn');
  if (pastWorkoutCloseBtn) {
    pastWorkoutCloseBtn.addEventListener('click', () => {
      pastWorkoutView.classList.add('hidden');
      calendarView.classList.remove('hidden');
    });
  }

  // Calendar month prev/next
  document.getElementById('calPrevBtn').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar(calYear, calMonth);
  });

  document.getElementById('calNextBtn').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar(calYear, calMonth);
  });

  // Home panel — logo click opens home
  const homeBtn = document.getElementById('homeBtn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      viewMode.classList.add('hidden');
      calendarView.classList.add('hidden');
      libraryView.classList.add('hidden');
      pastWorkoutView.classList.add('hidden');
      editMode.classList.add('hidden');
      homeView.classList.add('hidden');
      celebrationView.classList.add('hidden');
      if (UNDER_CONSTRUCTION) {
        document.getElementById('underConstruction').classList.remove('hidden');
      } else {
        homeView.classList.remove('hidden');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Home CTA — go to today's workout (always reloads from workout.json / localStorage)
  const homeToWorkoutBtn = document.getElementById('homeToWorkoutBtn');
  if (homeToWorkoutBtn) {
    homeToWorkoutBtn.addEventListener('click', async () => {
      homeView.classList.add('hidden');
      if (UNDER_CONSTRUCTION) {
        document.getElementById('underConstruction').classList.remove('hidden');
      } else {
        await loadWorkoutData();
        renderWorkoutView();
        viewMode.classList.remove('hidden');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Complete Workout button → show celebration
  const completeWorkoutBtn = document.getElementById('completeWorkoutBtn');
  if (completeWorkoutBtn) {
    completeWorkoutBtn.addEventListener('click', showCelebration);
  }

  // Celebration back button → return to home
  const celebBackBtn = document.getElementById('celebBackBtn');
  if (celebBackBtn) {
    celebBackBtn.addEventListener('click', async () => {
      celebrationView.classList.add('hidden');
      homeView.classList.remove('hidden');
      await loadWorkoutData();
      renderWorkoutView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
