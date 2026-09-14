// NeverLifts — Weight Log Analyzer
// Runs on every push to logs/*.json
// Writes logs/summary.json with PRs, trends, and weekly volume

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
const summaryPath = path.join(logsDir, 'summary.json');

// Read all dated log files (skip summary.json itself)
const files = fs.readdirSync(logsDir)
  .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/) && f !== 'summary.json')
  .sort();

if (files.length === 0) {
  console.log('No log files found.');
  process.exit(0);
}

// Parse each log file
const sessions = files.map(f => {
  const date = f.replace('.json', '');
  const raw = fs.readFileSync(path.join(logsDir, f), 'utf8');
  try {
    return { date, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}).filter(Boolean);

// Build per-exercise records
const records = {}; // { exerciseName: { date, maxWeight, totalVolume } }
const prs = {};     // { exerciseName: { date, weight } }

// Convert "M:SS" time string to total seconds for comparison
function timeToSeconds(str) {
  const parts = str.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

sessions.forEach(session => {
  const { date, exercises = [] } = session;
  exercises.forEach(ex => {
    const name = ex.name;
    const rawValues = (ex.sets || []).map(s => s.weight).filter(Boolean);
    if (rawValues.length === 0) return;

    // Detect time-based exercise (any set value contains ':')
    const isTime = rawValues.some(v => String(v).includes(':'));

    if (isTime) {
      // For time exercises: find the longest hold (max seconds), store as "M:SS"
      const timeValues = rawValues.filter(v => String(v).includes(':'));
      if (timeValues.length === 0) return;
      const best = timeValues.reduce((a, b) =>
        timeToSeconds(String(a)) >= timeToSeconds(String(b)) ? a : b
      );
      if (!records[name]) records[name] = [];
      records[name].push({ date, maxWeight: best, volume: 0, sets: ex.sets });
      if (!prs[name] || timeToSeconds(String(best)) > timeToSeconds(String(prs[name].weight))) {
        prs[name] = { date, weight: best };
      }
    } else {
      const weights = rawValues.map(v => parseFloat(v) || 0).filter(w => w > 0);
      if (weights.length === 0) return;
      const maxWeight = Math.max(...weights);
      const volume = weights.reduce((a, b) => a + b, 0);
      if (!records[name]) records[name] = [];
      records[name].push({ date, maxWeight, volume, sets: ex.sets });
      if (!prs[name] || maxWeight > prs[name].weight) {
        prs[name] = { date, weight: maxWeight };
      }
    }
  });
});

// Compute trends (last session vs previous)
const trends = {};
Object.entries(records).forEach(([name, sessions]) => {
  if (sessions.length < 2) return;
  const last = sessions[sessions.length - 1];
  const prev = sessions[sessions.length - 2];
  const diff = last.maxWeight - prev.maxWeight;
  trends[name] = {
    lastDate: last.date,
    prevDate: prev.date,
    lastMax: last.maxWeight,
    prevMax: prev.maxWeight,
    change: diff,
    trend: diff > 0 ? '📈 up' : diff < 0 ? '📉 down' : '➡️ same'
  };
});

// Weekly volume (last 7 days)
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
const weeklyVolume = {};
sessions
  .filter(s => new Date(s.date) >= weekAgo)
  .forEach(session => {
    (session.exercises || []).forEach(ex => {
      const vol = (ex.sets || []).reduce((a, s) => a + (parseFloat(s.weight) || 0), 0);
      weeklyVolume[ex.name] = (weeklyVolume[ex.name] || 0) + vol;
    });
  });

const summary = {
  lastUpdated: new Date().toISOString(),
  totalSessions: sessions.length,
  personalRecords: prs,
  trends,
  weeklyVolume,
  recentSessions: sessions.slice(-5).reverse().map(s => ({
    date: s.date,
    title: s.title || '',
    exercises: (s.exercises || []).map(ex => ({
      name: ex.name,
      sets: ex.sets
    }))
  }))
};

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(`✅ Summary written with ${sessions.length} sessions, ${Object.keys(prs).length} exercises tracked.`);
