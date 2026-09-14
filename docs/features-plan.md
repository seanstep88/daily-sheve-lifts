# NeverLifts — Features Plan

## Status Overview

| Task | Status |
|---|---|
| Sub-Task 1 — Calendar View | ✅ done |
| Sub-Task 2 — Per-set weight inputs (lbs + time) | ✅ done |
| Sub-Task 3 — EmailJS | ❌ scrapped — using Cloudflare Worker instead |
| Sub-Task 4 — Fix NeverLifts logo button (under construction) | ✅ done |
| Sub-Task L1 — Add `muscleGroup` to all workout JSONs | ✅ done |
| Sub-Task L2 — 🏆 Library button + `#libraryView` shell | ✅ done |
| Sub-Task L3 — Build exercise index at load time | ✅ done |
| Sub-Task L4 — Render unlocked cards, mystery cards, accordions | ✅ done |
| Sub-Task L5 — Library CSS | ✅ done |
| Exercise Videos — swap all GIFs for local MP4s | ✅ done |
| Fix log date bug — use `isoDate` from workout JSON | ✅ done |
| Folder/asset cleanup | ✅ done |

---

## Pending / Future

### "View Workout" button on library cards
Currently commented out. Needs `WORKOUT_DATES` to contain the PR date before it works reliably. Uncomment in `renderLibrary()` when ready.

### Exercise Library — add new exercises as they come
When a new workout JSON is added to `workouts/`:
1. Add `"muscleGroup"` and `"isoDate"` fields to each exercise
2. Add the date to `WORKOUT_DATES` in `app.js`
3. Add the date to `WORKOUT_DATES` in `app.js`
4. Push — library and calendar update automatically

### `logs/2026-09-10.json` — bad test data
Delete from GitHub repo directly, then resubmit Sep 8 and Sep 9 workouts to get clean PRs in `summary.json`.

### Plank Hold PR display
`summary.json` stores `weight: 0` for time-based exercises. The analyze script (`analyze.js`) needs to handle `unit: "time"` exercises differently — store the time string instead of a numeric max weight.
