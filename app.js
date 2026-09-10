// FitStep Application Logic

// 🚧 UNDER CONSTRUCTION FLAG — set to true while actively building, false to go live
const UNDER_CONSTRUCTION = false;

const STORAGE_KEY = 'fitstep_daily_workout';
const PROGRESS_KEY = 'fitstep_progress_state_v2';
const WEIGHTS_KEY = 'fitstep_weights_v1';
// 📬 GitHub Repo — weight log delivery
const GITHUB_TOKEN = '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';
const GITHUB_REPO = 'seanstep88/daily-sheve-lifts';

// Known workout dates — update this list when new workouts/YYYY-MM-DD.json files are added
const WORKOUT_DATES = [
  '2026-09-08',
  '2026-09-09',
];

// State
let workoutData = null;
// completedSets stores keys like "exIndex-setIndex" e.g., "0-1", "0-2"
let completedSets = new Set();
// Track which cards have their GIF open
let expandedGifs = new Set();
let timerInterval = null;
let remainingSeconds = 0;

// Elements
const viewMode = document.getElementById('viewMode');
const editMode = document.getElementById('editMode');
const calendarView = document.getElementById('calendarView');
const homeView = document.getElementById('homeView');
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
const completedCountEl = document.getElementById('completedCount');
const totalExerciseCountEl = document.getElementById('totalExerciseCount');
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
  if (UNDER_CONSTRUCTION) {
    document.getElementById('underConstruction').classList.remove('hidden');
    document.getElementById('viewMode').classList.add('hidden');
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

// 2. Render Workout View
function renderWorkoutView() {
  if (!workoutData) return;

  viewDate.textContent = workoutData.date || "Today's Workout";
  viewSets.textContent = workoutData.totalSets || "3-4 Sets";
  viewTitle.textContent = workoutData.title || "Daily Routine";
  
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
          <input
            type="number"
            class="weight-input"
            inputmode="decimal"
            placeholder="lb"
            data-ex-idx="${exIdx}"
            data-set-idx="${s}"
            oninput="onWeightInput()"
            onblur="onWeightBlur(${exIdx}, ${s}, this.value)"
          >
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="exercise-title-group">
          <span class="exercise-index">${exIdx + 1}</span>
          <h2 class="exercise-name" title="${escapeHtml(ex.name)}">${escapeHtml(ex.name)}</h2>
        </div>
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

    exercisesList.appendChild(card);
  });

  updateProgressDisplay();
  loadWeightsIntoDOM();
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

// Weight tracking
function getWeightStorageKey() {
  return `${WEIGHTS_KEY}_${workoutData ? (workoutData.date || 'default') : 'default'}`;
}

window.onWeightInput = function() {
  saveWeights();
};

window.onWeightBlur = function(exIdx, setIdx, value) {
  // Auto-fill remaining empty sets only when user finishes typing (on blur)
  if (setIdx === 1 && value !== '') {
    const allInputs = document.querySelectorAll(`.weight-input[data-ex-idx="${exIdx}"]`);
    allInputs.forEach(input => {
      if (parseInt(input.dataset.setIdx) > 1 && input.value === '') {
        input.value = value;
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

function loadWeightsIntoDOM() {
  if (!workoutData) return;
  const key = getWeightStorageKey();
  const saved = localStorage.getItem(key);
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    Object.entries(data).forEach(([exIdx, sets]) => {
      Object.entries(sets).forEach(([setIdx, value]) => {
        const input = document.querySelector(`.weight-input[data-ex-idx="${exIdx}"][data-set-idx="${setIdx}"]`);
        if (input) input.value = value;
      });
    });
  } catch (e) { /* ignore */ }
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

  return JSON.stringify({ title, date: new Date().toISOString().slice(0,10), exercises: exerciseData }, null, 2);
}

async function sendWeightsToGist() {
  const btn = document.getElementById('sendWeightsBtn');
  btn.textContent = '⏳ Sending…';
  btn.disabled = true;

  const date = new Date().toISOString().slice(0, 10);
  const path = `logs/${date}.json`;
  const summary = compileWeightSummary();
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Check if file already exists (need its SHA to update)
    let sha = null;
    const checkRes = await fetch(apiUrl, { headers });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }

    const body = {
      message: `weight log: ${date}`,
      content: btoa(unescape(encodeURIComponent(summary))),
      ...(sha ? { sha } : {})
    };

    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error('GitHub error', res.status, errBody);
      throw new Error(`${res.status}: ${errBody.message || 'unknown'}`);
    }

    btn.textContent = '✅ Sent!';
    setTimeout(() => {
      btn.textContent = '📬 Send Weights to Sean';
      btn.disabled = false;
    }, 2500);
  } catch (err) {
    console.error('sendWeights failed:', err);
    btn.textContent = `❌ ${err.message}`;
    btn.disabled = false;
  }
}

function updateProgressDisplay() {
  if (workoutData?.underConstruction) {
    if (completedCountEl) completedCountEl.textContent = "0";
    if (totalExerciseCountEl) totalExerciseCountEl.textContent = "0 sets";
    if (progressBarEl) progressBarEl.style.width = "0%";
    return;
  }

  const exercises = workoutData?.exercises || [];
  const bannerSets = workoutData?.totalSets || "3 Sets";
  
  let totalSetsCount = 0;
  exercises.forEach((ex) => {
    totalSetsCount += getSetCount(bannerSets, ex.target);
  });

  const doneSetsCount = completedSets.size;
  if (completedCountEl) completedCountEl.textContent = doneSetsCount;
  if (totalExerciseCountEl) totalExerciseCountEl.textContent = `${totalSetsCount} sets`;
  
  const pct = totalSetsCount > 0 ? Math.min(100, Math.round((doneSetsCount / totalSetsCount) * 100)) : 0;
  if (progressBarEl) progressBarEl.style.width = `${pct}%`;
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

    if (dateStr === todayStr) {
      cell.classList.add('today');
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', async () => {
        await loadWorkoutData();
        renderWorkoutView();
        calendarView.classList.add('hidden');
        viewMode.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
    if (WORKOUT_DATES.includes(dateStr)) {
      cell.classList.add('has-workout');
      cell.addEventListener('click', () => loadCalendarWorkout(dateStr));
    }

    grid.appendChild(cell);
  }
}

async function loadCalendarWorkout(dateStr) {
  try {
    const res = await fetch(`workouts/${dateStr}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error('Not found');
    workoutData = await res.json();
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
      calendarView.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Calendar close — return to view mode
  const calendarCloseBtn = document.getElementById('calendarCloseBtn');
  if (calendarCloseBtn) {
    calendarCloseBtn.addEventListener('click', () => {
      calendarView.classList.add('hidden');
      viewMode.classList.remove('hidden');
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
      editMode.classList.add('hidden');
      homeView.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Home CTA — go to today's workout (always reloads from workout.json / localStorage)
  const homeToWorkoutBtn = document.getElementById('homeToWorkoutBtn');
  if (homeToWorkoutBtn) {
    homeToWorkoutBtn.addEventListener('click', async () => {
      await loadWorkoutData();
      renderWorkoutView();
      homeView.classList.add('hidden');
      viewMode.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Send Weights button
  const sendWeightsBtn = document.getElementById('sendWeightsBtn');
  if (sendWeightsBtn) {
    sendWeightsBtn.addEventListener('click', sendWeightsToGist);
  }

  // Show send button whenever any weight field has a value
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('weight-input')) {
      const anyFilled = [...document.querySelectorAll('.weight-input')].some(i => i.value !== '');
      if (sendWeightsBtn) sendWeightsBtn.classList.toggle('hidden', !anyFilled);
    }
  });
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
