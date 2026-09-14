# NeverLifts — Features Plan

## Overview

Three new features added to the existing plain HTML/CSS/JS app (no build system, no npm):

1. **Calendar View** — a top-right button opens a monthly calendar; days with a workout JSON in `workouts/` are highlighted purple; tapping a day loads and displays that workout.
2. **Weight Tracker** — each exercise card gets per-set weight input fields; typing in Set 1 auto-fills the rest; a "Send Weights" button emails the full session log to sean.stepanek08@gmail.com via EmailJS.
3. **EmailJS Wiring** — one-time setup that loads EmailJS from CDN and sends a formatted weight log email on demand.

The existing view-switching pattern (add/remove `.hidden` class) is used for the calendar panel. No routing library, no build step, no npm.

---

## Sub-Task 1 — Calendar View UI & Navigation

**Intent**
Add a calendar icon button in the top-right header that toggles a full-screen calendar panel showing the current month. Days that have a matching `workouts/YYYY-MM-DD.json` file are highlighted in light purple. The user can tap a highlighted day to view that workout.

**Expected Outcomes**
- A calendar button appears in the header (top right, next to the existing hidden edit/reset buttons area).
- Clicking it slides in a calendar panel that covers the main content (same `.hidden` toggle pattern as edit mode).
- The current month is rendered as a grid with day numbers.
- Days with a workout file are visually highlighted (light purple pill/circle).
- A back/close button returns to the main workout view.
- Tapping a highlighted day closes the calendar and renders that day's workout in the view.

**Todo List**
1. Add a calendar button `#calendarBtn` to the header actions in `index.html`.
2. Add a `<section id="calendarView">` panel in `index.html` (sibling to `#viewMode` and `#editMode`), hidden by default.
3. Inside the panel: a month/year header with prev/next month arrows, a 7-column day-of-week header row, and a `#calendarGrid` div where day cells are rendered.
4. Add `.calendar-view`, `.calendar-header`, `.calendar-grid`, `.calendar-day`, `.calendar-day.has-workout`, `.calendar-day.today` CSS classes to `styles.css`.
5. In `app.js`, add a `WORKOUT_DATES` array — a hardcoded list of known `YYYY-MM-DD` strings that exist in `workouts/`. (Because the app is static, it cannot `readdir` the folder; Sean manually keeps this list in sync when he drops new files in.)
6. Add `renderCalendar(year, month)` function that builds the day grid, marks dates in `WORKOUT_DATES` with the `has-workout` class.
7. Add click handler on `#calendarBtn` that shows `#calendarView` and hides `#viewMode`.
8. Add close button handler that reverses the above.
9. Add click handler on `.has-workout` day cells that fetches `workouts/YYYY-MM-DD.json`, sets `workoutData`, calls `renderWorkoutView()`, and returns to view mode.

**Relevant Context**
- Existing toggle pattern: `app.js` `openEditor()` / cancel handler — add/remove `.hidden`
- `viewMode`, `editMode` element refs already declared at top of `app.js`
- `renderWorkoutView()` already accepts whatever is in `workoutData` — just set it and call it
- Workout files are named `YYYY-MM-DD.json` (e.g. `workouts/2025-02-24-push.json` uses a slightly different suffix — new files should follow strict `YYYY-MM-DD.json` naming)
- Styles follow the existing dark theme CSS variables in `:root`

**Status** — `[ ] pending`

---

## Sub-Task 2 — Per-Set Weight Inputs on Exercise Cards

**Intent**
Add weight input fields to each exercise card — one field per set. Typing a value into the first set auto-fills all subsequent set fields for that exercise. Fields are persisted in `localStorage` so they survive a page refresh. Exercises with `"unit": "time"` get a `MM:SS` time input instead of a number/lbs input — this handles planks, dead hangs, wall sits, and any future hold exercises.

**Expected Outcomes**
- Each exercise card shows a row of small inputs labeled "Set 1", "Set 2", etc., matching the set count.
- Entering a value in Set 1 immediately fills Set 2, Set 3, etc. for that exercise only.
- Editing a later set field does not affect other fields.
- Exercises with `"unit": "lbs"` (or no `unit` field — default) show `<input type="number" placeholder="lbs">`.
- Exercises with `"unit": "time"` show `<input type="text" placeholder="0:00" pattern="[0-9]+:[0-5][0-9]">` — a MM:SS text field.
- The auto-fill-from-Set-1 behavior works the same for both input types.
- Values are saved to `localStorage` under key `fitstep_weights_v1` (keyed by workout date + exercise name).
- Values are restored on page load.

**Todo List**
1. In `renderWorkoutView()` in `app.js`, after rendering each exercise card's set checkboxes, append a weight/time inputs row.
2. Parse the set count from the exercise `target` string with a helper `parseSetCount(target, totalSets)`. Fall back to the workout-level `totalSets` if not found.
3. Check `ex.unit` — if `"time"`, render `<input type="text" class="weight-input time-input" placeholder="0:00">` per set; otherwise render `<input type="number" class="weight-input" placeholder="lbs">`.
4. Add `data-ex-idx`, `data-set-idx`, and `data-unit` attributes to each input.
5. Add a `window.onWeightInput(el)` handler: if the input is Set 0, fill all other set inputs for that exercise with the same value.
6. Add `saveWeights()` / `loadWeights()` using `localStorage` key `fitstep_weights_v1`, stored as `{ [workoutDate]: { [exerciseName]: [v1, v2, v3] } }` — values are strings for both types.
7. Call `loadWeights()` after `renderWorkoutView()` to repopulate fields.
8. Add `.weight-input-row`, `.weight-input-label`, `.weight-input`, `.time-input` CSS to `styles.css` — compact, inline, dark-themed to match existing set checkboxes.

**Relevant Context**
- Set checkboxes rendered in `renderWorkoutView()` around `app.js:200–250` — weight row goes directly below
- `getSetCount()` helper already exists at `app.js:125` — reuse or extend it for `parseSetCount`
- Existing localStorage pattern: `saveProgress()` / `loadProgress()` at `app.js:287–300`
- `"unit": "time"` is a new optional field — default is lbs if absent; add it to Plank Hold in `workouts/2026-09-08.json`
- PR badge in the library (Sub-Task L4) should display time values as-is (e.g. `1:30`) and lbs values as `X lbs`

**Status** — `[ ] pending`

---

## Sub-Task 3 — "Send Weights" Button + EmailJS Integration

**Intent**
Add a sticky "Send Weights 📬" button that appears once any weight field has been filled in. Tapping it sends a formatted email to sean.stepanek08@gmail.com via EmailJS (free tier, CDN-loaded) with all exercise weights for the session. Sean configures his EmailJS service ID and template ID as constants at the top of `app.js`.

**Expected Outcomes**
- A `#sendWeightsBtn` button is hidden by default and becomes visible once at least one weight field is non-empty.
- Tapping it compiles a plain-text weight summary (workout title, date, per-exercise per-set weights) and sends via `emailjs.send()`.
- On success: button shows "✅ Sent!" briefly then resets.
- On failure: button shows "❌ Failed — try again".
- EmailJS public key, service ID, and template ID are defined as easy-to-find constants at the top of `app.js` with a comment pointing Sean to emailjs.com to fill them in.
- EmailJS SDK is loaded from CDN in `index.html` (one `<script>` tag).

**Todo List**
1. Add EmailJS CDN script tag to `index.html` (before `app.js`).
2. Add three constants near top of `app.js`: `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID` with placeholder strings and setup comments.
3. On `DOMContentLoaded`, call `emailjs.init(EMAILJS_PUBLIC_KEY)`.
4. Add `#sendWeightsBtn` to `index.html` inside `#viewMode`, below the exercises container.
5. Add `compiledWeightSummary()` function that loops over `workoutData.exercises`, reads current weight input values from the DOM, and builds a formatted string.
6. Add click handler on `#sendWeightsBtn` that calls `compiledWeightSummary()` and `emailjs.send()` with a template params object `{ to_email, workout_title, workout_date, weight_summary }`.
7. Show/hide `#sendWeightsBtn` by listening to `input` events on `.weight-input` fields — show if any field has a value.
8. Add button styles to `styles.css` — full-width, accent color, positioned below the exercises list.

**Relevant Context**
- EmailJS free tier: 200 emails/month, CDN: `https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js`
- EmailJS template must have params matching the object in step 6 — Sean sets this up in the EmailJS dashboard
- Existing button styles `.btn-primary` in `styles.css` can be the base style
- `workoutData` is module-level, accessible anywhere in `app.js`

**Status** — `[ ] pending`

---

## Setup Notes for Sean (do before implementing Sub-Task 3)

1. Go to [emailjs.com](https://www.emailjs.com) → sign up free
2. Add an **Email Service** (Gmail) → copy the **Service ID**
3. Create an **Email Template** with these variables: `{{workout_title}}`, `{{workout_date}}`, `{{weight_summary}}` → copy the **Template ID**
4. Go to Account → **Public Key** → copy it
5. Paste all three into the constants at the top of `app.js`

---

## Exercise Videos (Next Session)

**Goal:** Replace external GIF links with local MP4s for all exercises for reliability and speed.

**How it works:**
- Download each exercise clip (yt-dlp or manual), trim to 5-15 seconds
- Save to `exercises/videos/exercise-name.mp4`
- Update `mediaUrl` in the relevant workout JSON to `exercises/videos/exercise-name.mp4`
- Commit and push — GitHub Pages serves them directly

**Exercises to update (current workout.json):**
- [ ] Incline dumbbell bench press — `exercises/videos/incline-db-press.mp4`
- [x] Dumbbell Tricep Extension — `exercises/videos/tricep-extension.mp4` ✅
- [ ] Dumbbell lateral raises — `exercises/videos/lateral-raises.mp4`
- [ ] Dumbbell front raises — `exercises/videos/front-raises.mp4`

**Also update workouts/ files:**
- [ ] `workouts/2026-09-08.json` — replace any external GIF URLs
- [ ] `workouts/2026-09-09.json` — replace any external GIF URLs

**Notes:**
- Use `yt-dlp -f mp4 <url> -o "exercises/videos/<name>.mp4"` to download
- MP4s are 5-10x smaller than GIFs and load faster on mobile
- The app already auto-detects `.mp4` extension and uses a `<video>` tag


---

## Sub-Task 4 — Fix "NeverLifts" Logo Button During Under Construction ✅

**Intent**
When `UNDER_CONSTRUCTION` is `true` and Neve taps the "NeverLifts" logo in the header, the current code shows `#homeView` without hiding `#underConstruction`. This makes the coming-soon card and the home screen appear at the same time. The fix: when in under-construction mode, tapping the logo should hide everything and show only `#underConstruction` — the same clean state as app load.

**Expected Outcomes**
- Tapping "NeverLifts" while `UNDER_CONSTRUCTION` is `true` hides all views and shows only `#underConstruction` — no home screen visible.
- Tapping "NeverLifts" while `UNDER_CONSTRUCTION` is `false` continues to work as before (shows `#homeView`).
- Also hides calendar and library views if they happen to be open when the logo is tapped.

**Todo List**
1. In `app.js`, inside the `homeBtn` click handler (currently at line ~1131), add a branch: if `UNDER_CONSTRUCTION`, hide all views (`viewMode`, `calendarView`, `editMode`, `homeView`, `#libraryView`) and show `#underConstruction` — then `return`. Otherwise fall through to the existing logic.

**Relevant Context**
- `homeBtn` click handler: `app.js:1131–1137`
- `UNDER_CONSTRUCTION` constant: `app.js:3`
- Same pattern used in `homeToWorkoutBtn` handler: `app.js:1145–1147`

**Status** — `[x] done`

---

## Exercise Library View (Future)

**Goal:** A trophy/library button in the header (next to the 📅 calendar button) that opens a full exercise library showing every exercise Neve has ever done, with her best performance and a link back to the workout it came from.

**What it shows:**
- Every unique exercise name across all `logs/*.json` files, **grouped by muscle group**
- The exercise GIF/video (matched from current workout JSON files by name)
- **Max weight** ever lifted for that exercise + the date it happened
- **Max reps** target from the workout JSON
- A "📅 View workout" link that opens that date in the calendar view

**Muscle group sections (collapsible, in this order):**
1. 💪 Chest
2. 🔙 Back
3. 🦵 Legs
4. 🏋️ Shoulders
5. 💥 Triceps
6. 🦾 Biceps
7. 🧘 Core
8. 🫀 Cardio / Other

**Data source:**
- `logs/summary.json` already has `personalRecords: { [exerciseName]: { date, weight } }` — use this
- Exercise GIF/video URLs come from matching the exercise name across `workout.json` and `workouts/*.json`
- Muscle group assigned per exercise in workout JSON via a new optional `"muscleGroup"` field (e.g. `"muscleGroup": "Shoulders"`). Falls back to "Other" if not set.
- Link back to the workout by loading `workouts/YYYY-MM-DD.json` for that PR date (same as calendar day tap)

**UI:**
- New button in header: 🏆 (sits next to 📅)
- New `#libraryView` section (sibling to all other views, hidden by default)
- Muscle group headers as sticky section dividers — tap to collapse/expand
- Cards under each group: GIF/video, exercise name, max weight badge, PR date, "View Workout" button
- ← Back button returns to wherever she came from (construction screen or home)

**Implementation notes:**
- Add `"muscleGroup"` field to exercises in `workout.json` and `workouts/*.json`
- Build a name→mediaUrl map by fetching all workout JSON files at load time
- Fall back to 🏋️ emoji if no media found for that exercise name
- Available during under construction mode (same pattern as calendar)

**Status:** `[ ] pending`

