/**
 * StelarGB — SECURE demo app
 * ---------------------------------------------------------------
 * Same app, same schema, same seed data, same routes as
 * ../vulnerable-app/server.js — the only thing that changed is
 * (1) SQL queries use bound parameters instead of string concatenation,
 * (2) user-controlled text is HTML-escaped before being rendered.
 * This is what the StelarGB skill/prompts force an LLM to produce.
 * ---------------------------------------------------------------
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const { createDb } = require('./db');

const PORT = process.env.PORT || 4002;
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let db;

// Minimal, explicit HTML-encoding — contextual output encoding, pillar #3 of the PRD.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const banner = `
<div style="background:#14532d;color:#fff;padding:10px 16px;font-family:monospace;font-size:13px">
  ✅ SECURE DEMO — StelarGB comparison app — same features, patched
</div>`;

function layout(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <title>${title} · StelarGB Secure Demo</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:0 20px 40px;background:#0b0e14;color:#e5e7eb}
    input,button{font-size:15px;padding:8px;margin:4px 0;width:100%;box-sizing:border-box}
    button{background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer}
    .card{background:#151922;border:1px solid #2a2f3a;border-radius:10px;padding:14px;margin:10px 0}
    a{color:#4ade80}
    code{background:#1f2430;padding:2px 5px;border-radius:4px}
  </style></head>
  <body>${banner}<h1>${title}</h1>${body}</body></html>`;
}

app.get('/', (req, res) => {
  res.send(layout('Login', `
    <form method="POST" action="/login">
      <label>Username</label><input name="username" autocomplete="off">
      <label>Password</label><input name="password" type="password">
      <button type="submit">Log in</button>
    </form>
    <p style="opacity:.7;font-size:13px">Try the exact same payload you used on the vulnerable app,
    e.g. <code>admin' --</code> — it will just fail as invalid credentials here.</p>
    <p><a href="/board">Skip to comment board (XSS demo) →</a></p>
  `));
});

// --- FIX: parameterized query, bound values, no string concatenation ---
app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;

  const stmt = db.prepare('SELECT id, username FROM users WHERE username = ? AND password = ?;');
  stmt.bind([username, password]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  if (rows.length > 0) {
    res.send(layout('Logged in', `
      <div class="card">
        <p>✅ Logged in as <b>${escapeHtml(rows[0].username)}</b></p>
        <p style="opacity:.7;font-size:13px">Query used bound parameters — the input is treated purely as data, never as SQL syntax.</p>
      </div>
      <p><a href="/board">Go to comment board →</a></p>
    `));
  } else {
    res.send(layout('Login failed', `<div class="card">Invalid credentials.</div><p><a href="/">Back</a></p>`));
  }
});

app.get('/board', (req, res) => {
  const stmt = db.prepare('SELECT author, body, created_at FROM comments ORDER BY id DESC;');
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  // --- FIX: escape user-controlled text before inserting into HTML ---
  const commentsHtml = rows.map(r => `
    <div class="card"><b>${escapeHtml(r.author)}</b> <span style="opacity:.6">(${escapeHtml(r.created_at)})</span><p>${escapeHtml(r.body)}</p></div>
  `).join('');

  res.send(layout('Comment board', `
    <form method="POST" action="/comment">
      <label>Name</label><input name="author" autocomplete="off">
      <label>Comment</label><input name="body" autocomplete="off">
      <button type="submit">Post</button>
    </form>
    <p style="opacity:.7;font-size:13px">Try posting <code>&lt;script&gt;alert(document.cookie)&lt;/script&gt;</code> again — it will render as plain, inert text.</p>
    ${commentsHtml}
  `));
});

app.post('/comment', (req, res) => {
  const { author = 'anonymous', body = '' } = req.body;
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  db.run(`INSERT INTO comments (author, body, created_at) VALUES (?, ?, ?);`, [author, body, ts]);
  res.redirect('/board');
});

createDb().then((database) => {
  db = database;
  app.listen(PORT, () => console.log(`Secure demo running → http://localhost:${PORT}`));
});
