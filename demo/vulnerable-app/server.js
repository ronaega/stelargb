/**
 * StelarGB — VULNERABLE demo app
 * ---------------------------------------------------------------
 * ⚠️  INTENTIONALLY INSECURE. For local, offline education only.
 *     Do NOT deploy this anywhere reachable from the internet.
 *
 * This is the "before" side of the comparison: code written the way
 * an LLM will produce it by default if nobody tells it to care about
 * security — string-concatenated SQL, and raw HTML interpolation of
 * user input. Compare server.js line-by-line with ../secure-app/server.js.
 * ---------------------------------------------------------------
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const { createDb } = require('./db');

const PORT = process.env.PORT || 4001;
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let db; // in-memory sql.js database, real SQLite engine

const banner = `
<div style="background:#7f1d1d;color:#fff;padding:10px 16px;font-family:monospace;font-size:13px">
  ⚠️ VULNERABLE DEMO — StelarGB comparison app — local/offline use only
</div>`;

function layout(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <title>${title} · StelarGB Vulnerable Demo</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:0 20px 40px;background:#0b0e14;color:#e5e7eb}
    input,button{font-size:15px;padding:8px;margin:4px 0;width:100%;box-sizing:border-box}
    button{background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer}
    .card{background:#151922;border:1px solid #2a2f3a;border-radius:10px;padding:14px;margin:10px 0}
    a{color:#f87171}
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
    <p style="opacity:.7;font-size:13px">Try the SQLi payload from the README in the username field
    with any password, e.g. <code>admin' --</code></p>
    <p><a href="/board">Skip to comment board (XSS demo) →</a></p>
  `));
});

// --- SQL INJECTION: query built with raw string concatenation ---
app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;

  const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}';`;

  let rows = [];
  try {
    const result = db.exec(sql);
    if (result.length) {
      rows = result[0].values.map(v => ({ id: v[0], username: v[1] }));
    }
  } catch (e) {
    return res.send(layout('Login error', `<div class="card">Query error: ${e.message}</div><p><a href="/">Back</a></p>`));
  }

  if (rows.length > 0) {
    res.send(layout('Logged in', `
      <div class="card">
        <p>✅ Logged in as <b>${rows[0].username}</b></p>
        <p style="opacity:.7;font-size:13px">The raw SQL that ran:<br><code>${sql.replace(/</g,'&lt;')}</code></p>
      </div>
      <p><a href="/board">Go to comment board →</a></p>
    `));
  } else {
    res.send(layout('Login failed', `<div class="card">Invalid credentials.</div><p><a href="/">Back</a></p>`));
  }
});

app.get('/board', (req, res) => {
  const result = db.exec('SELECT author, body, created_at FROM comments ORDER BY id DESC;');
  const rows = result.length ? result[0].values : [];

  // --- STORED XSS: comment body inserted into HTML with no encoding ---
  const commentsHtml = rows.map(([author, body, ts]) => `
    <div class="card"><b>${author}</b> <span style="opacity:.6">(${ts})</span><p>${body}</p></div>
  `).join('');

  res.send(layout('Comment board', `
    <form method="POST" action="/comment">
      <label>Name</label><input name="author" autocomplete="off">
      <label>Comment</label><input name="body" autocomplete="off">
      <button type="submit">Post</button>
    </form>
    <p style="opacity:.7;font-size:13px">Try posting <code>&lt;script&gt;alert(document.cookie)&lt;/script&gt;</code> as a comment.</p>
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
  app.listen(PORT, () => console.log(`Vulnerable demo running → http://localhost:${PORT}`));
});
