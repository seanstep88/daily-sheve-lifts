// FitStep Application Logic
const STORAGE_KEY = 'fitstep_daily_workout';
const PROGRESS_KEY = 'fitstep_progress_state_v2';

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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  loadProgress();
  await loadWorkoutData();
  renderWorkoutView();
  setupEventListeners();
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

    // Generate individual checkboxes for each set
    let setCheckboxesHtml = '';
    for (let s = 1; s <= setCount; s++) {
      const setKey = `${exIdx}-${s}`;
      const isSetDone = completedSets.has(setKey);
      setCheckboxesHtml += `
        <label class="set-check-item ${isSetDone ? 'done' : ''}">
          <input type="checkbox" ${isSetDone ? 'checked' : ''} onchange="toggleSetDone(${exIdx}, ${s})">
          <span>Set ${s}</span>
        </label>
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
          <div class="sets-checkbox-group">
            ${setCheckboxesHtml}
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

function updateProgressDisplay() {
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

// 5. Editor Features
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
  toggleEditBtn.addEventListener('click', openEditor);
  
  cancelEditBtn.addEventListener('click', () => {
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

  saveAndApplyBtn.addEventListener('click', () => {
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

  downloadJsonBtn.addEventListener('click', () => {
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
