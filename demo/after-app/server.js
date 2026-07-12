/**
 * StelarGB demo — "after" app.
 *
 * This is Claude's own generation from demo/generation-transcripts/after-with-skill.md,
 * produced with web-prompts/claude-projects.md loaded as the system prompt,
 * wired up to run against the shared db.js seed data (which adds a created_at
 * column the raw transcript didn't need). The login/comment logic below is
 * otherwise unchanged from the transcript.
 */
const express = require('express');
const { createDb } = require('./db');

const PORT = process.env.PORT || 4002;
const app = express();
app.use(express.urlencoded({ extended: false }));
let db;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const banner = `<div style="background:#14532d;color:#fff;padding:10px 16px;font-family:monospace;font-size:13px">✅ AFTER — generated with the StelarGB claude-projects.md prompt loaded (see demo/generation-transcripts/after-with-skill.md)</div>`;

app.get('/', (req, res) => {
  res.send(`${banner}
    <form method="POST" action="/login">
      <input name="username" placeholder="username"><br>
      <input name="password" type="password" placeholder="password"><br>
      <button>Log in</button>
    </form>
    <p><a href="/board">Comment board →</a></p>`);
});

app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;

  const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
  stmt.bind([username, password]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  if (rows.length) {
    res.send(`${banner}<p>Welcome back, ${escapeHtml(rows[0].username)}!</p><p><a href="/board">Comment board →</a></p>`);
  } else {
    res.send(`${banner}<p>Invalid login.</p><p><a href="/">Back</a></p>`);
  }
});

app.get('/board', (req, res) => {
  const stmt = db.prepare('SELECT author, body FROM comments ORDER BY id DESC');
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  const html = rows.map(r =>
    `<div><b>${escapeHtml(r.author)}</b>: ${escapeHtml(r.body)}</div>`
  ).join('');

  res.send(`${banner}
    <form method="POST" action="/comment">
      <input name="author" placeholder="name">
      <input name="body" placeholder="comment">
      <button>Post</button>
    </form>
    ${html}`);
});

app.post('/comment', (req, res) => {
  const { author = 'anonymous', body = '' } = req.body;
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  db.run('INSERT INTO comments (author, body, created_at) VALUES (?, ?, ?)', [author, body, ts]);
  res.redirect('/board');
});

createDb().then((database) => {
  db = database;
  app.listen(PORT, () => console.log(`"After" demo running → http://localhost:${PORT}`));
});
