# Celebration Screen + PR Detection + Auto-fill Plan

## Overview

Four features built together:

1. **Complete Workout button** — replaces "Sets Completed" text in the tracker card. Fires send-to-GitHub + shows celebration screen.
2. **Celebration screen** — confetti falls and fades, new pig image, "you lifted the equivalent of X" with emoji, then scrollable workout recap below.
3. **PR detection** — reads `logs/summary.json` to compare today's max weight per exercise vs stored PR. Flags new PRs with 🏆 in the recap.
4. **Auto-fill last weights** — on workout load, fetches `logs/summary.json` and pre-fills weight inputs with last session's weights for matching exercises. Inputs shown slightly dimmed until user edits them.

---

## Weight Equivalent Items Table

Total volume = sum of (weight × reps) across all sets/exercises.
Reps parsed from target string e.g. "15 Reps", "8-10 Reps" (use upper number).

| Volume (lbs) | Item | Emoji |
|---|---|---|
| 0–300 | about 1 Shawn | 🐑 |
| 300–700 | a NYC fire hydrant | 🚒 |
| 700–1200 | a Philly cheesesteak catering order | 🥩 |
| 1200–2000 | a wild boar | 🐗 |
| 2000–3500 | a baby grand piano | 🎹 |
| 3500–6000 | the Villanova basketball team | 🏀 |
| 6000–10000 | a NYC yellow taxi cab | 🚕 |
| 10000–18000 | a T-Rex skull replica | 🦕 |
| 18000–30000 | an aerial tramway car | 🚡 |
| 30000–50000 | the Liberty Bell | 🔔 |
| 50000+ | a Staten Island Ferry | ⛴️ |

---

## Sub-Task 1 — HTML Structure

**Intent:** Add the Complete Workout button and the celebration section to index.html.

**Todo:**
- [ ] Replace "Sets Completed" span in `.tracker-header` with `#completeWorkoutBtn` button
- [ ] Comment out `#sendWeightsBtn`
- [ ] Add `#celebrationView` section (sibling to viewMode/calendarView/homeView) with:
  - `<canvas id="confettiCanvas">` for confetti
  - celeb hero image (ChatGPT Image Sep 10, 2026 at 02_04_28 AM.png)
  - `#celebTitle`, `#celebVolume`, `#celebItemCard` (emoji + text), `#celebRecap`
  - `#celebBackBtn` → goes to homeView

**Status:** `[ ] pending`

---

## Sub-Task 2 — JS: Complete Workout + Volume Calc + Weight Equivalent

**Intent:** Wire up the Complete Workout button — calculate total volume, pick the weight item, send weights to GitHub, show celebration screen.

**Todo:**
- [ ] Add `parseRepCount(targetStr)` helper — extracts rep count from strings like "15 Reps", "8-10 Reps" (use upper), "3 Sets × 10 Reps". Default 10.
- [ ] Add `calcTotalVolume()` — loops exercises, for each set reads the weight input value, multiplies by rep count, sums all.
- [ ] Add `getWeightItem(volumeLbs)` — returns `{ emoji, text }` from the table above.
- [ ] Add `showCelebration()` — async function that:
  1. Calls `sendWeightsToGist()` silently in background
  2. Calculates volume
  3. Picks weight item
  4. Loads PR data from `logs/summary.json` (fetch, ignore errors)
  5. Builds recap HTML (exercise name, sets, weights, 🏆 if new PR)
  6. Hides viewMode, shows celebrationView
  7. Fires confetti animation
- [ ] Wire `#completeWorkoutBtn` click → `showCelebration()`
- [ ] Wire `#celebBackBtn` → hide celebrationView, show homeView, reload workout data

**Relevant context:**
- `sendWeightsToGist()` already exists — just call it, don't await blocking UI
- `getSetCount()` and `getWeightStorageKey()` already exist
- `logs/summary.json` shape: `{ personalRecords: { [exerciseName]: { date, weight } } }`
- weight inputs: `.weight-input[data-ex-idx][data-set-idx]`

**Status:** `[ ] pending`

---

## Sub-Task 3 — JS: Auto-fill Last Weights

**Intent:** On workout render, fetch `logs/summary.json`, find the most recent session for each exercise, pre-fill weight inputs with last used weights. Dimmed until user edits.

**Todo:**
- [ ] Add `autoFillLastWeights()` async function:
  - Fetch `logs/summary.json` from repo raw URL
  - Find most recent session containing each exercise by name
  - For each matching weight input, set value + add class `weight-input--autofill`
- [ ] Call `autoFillLastWeights()` at end of `renderWorkoutView()` (after `loadWeightsIntoDOM()`) — only if no saved weights exist for today
- [ ] In `onWeightBlur` / `onWeightInput` — remove `weight-input--autofill` class on that input when user edits it
- [ ] CSS: `.weight-input--autofill` → `opacity: 0.5`, `font-style: italic`

**Relevant context:**
- Raw URL for summary: `https://raw.githubusercontent.com/seanstep88/daily-sheve-lifts/main/logs/summary.json`
- `recentSessions` array in summary.json has last 5 sessions with exercise names + sets
- Only autofill if `loadWeightsIntoDOM()` found nothing for today (check if any input has a value after load)

**Status:** `[ ] pending`

---

## Sub-Task 4 — JS + CSS: Confetti Animation

**Intent:** Pure JS canvas confetti — colored squares/circles fall from top, fade out over ~3 seconds. No external library.

**Todo:**
- [ ] `launchConfetti()` — creates N=120 particles with random x, color, speed, size
- [ ] `animateConfetti()` — rAF loop updating positions, fades canvas opacity out after 2.5s, stops at 4s
- [ ] Canvas sized to full viewport, `position: fixed`, `pointer-events: none`, `z-index: 999`
- [ ] Colors: purple (#a78bfa), pink (#fb7185), gold (#fbbf24), sky (#38bdf8), white

**Status:** `[ ] pending`

---

## Sub-Task 5 — CSS: Celebration Screen Styles

**Intent:** Style the celebration screen to match the dark theme.

**Todo:**
- [ ] `.celebration-view` — max-width 420px, centered, padding-bottom 40px
- [ ] `.confetti-canvas` — fixed, full viewport, pointer-events none, z-index 999
- [ ] `.celeb-hero` — full width, rounded corners, shadow
- [ ] `.celeb-badge` — purple pill badge
- [ ] `.celeb-title` — large bold white
- [ ] `.celeb-volume` — secondary text
- [ ] `.celeb-item-card` — dark card with border, large emoji, description text
- [ ] `.celeb-recap` — exercise cards, name + sets + weights, 🏆 PR badge
- [ ] `.celeb-back-btn` — full width primary button
- [ ] `.complete-workout-btn` — purple gradient, same style as send-weights-btn
- [ ] `.weight-input--autofill` — opacity 0.5, italic

**Status:** `[ ] pending`
