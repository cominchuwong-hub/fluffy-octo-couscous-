const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const dataFile = path.join(__dirname, 'leaderboard.json');
const indexFile = path.join(__dirname, 'index.html');
const aboutFile = path.join(__dirname, 'about.html');
const summaryFile = path.join(__dirname, 'server.html');

function readLeaderboard() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    fs.writeFileSync(dataFile, '[]');
    return [];
  }
}

function saveLeaderboard(entries) {
  fs.writeFileSync(dataFile, JSON.stringify(entries, null, 2));
}

function buildLeaderboardSummary(entries) {
  const grouped = new Map();

  entries.forEach((entry) => {
    const name = String(entry.name || '').trim();
    if (!name) return;

    const existing = grouped.get(name) || {
      name,
      score: entry.score,
      bestScore: entry.score,
      plays: 0,
      lastPlayedAt: entry.createdAt || ''
    };

    existing.plays += 1;

    if (entry.score > existing.bestScore) {
      existing.bestScore = entry.score;
      existing.score = existing.bestScore;
    }

    if (!existing.lastPlayedAt || (entry.createdAt || '') > existing.lastPlayedAt) {
      existing.lastPlayedAt = entry.createdAt || '';
    }

    grouped.set(name, existing);
  });

  return [...grouped.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function readIndexPage() {
  return fs.readFileSync(indexFile, 'utf8');
}

function readAboutPage() {
  return fs.readFileSync(aboutFile, 'utf8');
}

function readSummaryPage() {
  return fs.readFileSync(summaryFile, 'utf8');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readIndexPage());
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/about' || url.pathname === '/about.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readAboutPage());
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/server.html' || url.pathname === '/result')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readSummaryPage());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    const leaderboard = buildLeaderboardSummary(readLeaderboard());
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ leaderboard }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/submit') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const { name, score } = JSON.parse(body);
        const trimmedName = String(name || '').trim();
        const numericScore = Number(score);

        if (!trimmedName) {
          throw new Error('กรุณากรอกชื่อ');
        }

        if (!Number.isFinite(numericScore)) {
          throw new Error('กรุณากรอกคะแนนให้ถูกต้อง');
        }

        const leaderboard = readLeaderboard();
        const entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: trimmedName,
          score: numericScore,
          createdAt: new Date().toISOString()
        };

        leaderboard.push(entry);
        saveLeaderboard(leaderboard);

        const summary = buildLeaderboardSummary(leaderboard);
        const rank = summary.find((item) => item.name === trimmedName)?.rank || 1;

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          entry,
          ranking: rank,
          totalPlayers: summary.length,
          leaderboard: summary.slice(0, 10)
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ success: false, message: 'ไม่พบหน้า' }));
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
