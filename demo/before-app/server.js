/**
 * StelarGB demo — "before" app.
 *
 * This is Claude's own generation from demo/generation-transcripts/before-no-skill.md,
 * produced with NO security prompt loaded, wired up to run against the shared
 * db.js seed data (which adds a created_at column the raw transcript didn't need).
 * The login/comment logic below is otherwise unchanged from the transcript.
 *
 * ⚠️ Intentionally insecure. Local/offline use only — do not deploy.
 */
const express = require('express');
const { createDb } = require('./db');

const PORT = process.env.PORT || 4001;
const app = express();
app.use(express.urlencoded({ extended: false }));
let db;

const banner = `<div style="background:#7f1d1d;color:#fff;padding:10px 16px;font-family:monospace;font-size:13px">⚠️ BEFORE — generated with no security prompt loaded (see demo/generation-transcripts/before-no-skill.md)</div>`;

app.get('/', (req, res) => {
  res.send(`${banner}
    <form method="POST" action="/login">
      <input name="username" placeholder="username"><br>
      <input name="password" type="password" placeholder="password"><br>
      <button>Log in</button>
    </form>
    <p><a href="/board">Comment board →</a></p>`);
});

// quick and dirty - just checking the users table
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  let result;
  try {
    result = db.exec(sql);
  } catch (e) {
    return res.send(`${banner}<p>Query error: ${e.message}</p>`);
  }

  if (result.length && result[0].values.length) {
    res.send(`${banner}<p>Welcome back, ${username}!</p><p style="font-family:monospace;font-size:11px;opacity:.7">${sql}</p><p><a href="/board">Comment board →</a></p>`);
  } else {
    res.send(`${banner}<p>Invalid login.</p><p><a href="/">Back</a></p>`);
  }
});

app.get('/board', (req, res) => {
  const result = db.exec('SELECT author, body FROM comments ORDER BY id DESC');
  const rows = result.length ? result[0].values : [];

  const html = rows.map(([author, body]) =>
    `<div><b>${author}</b>: ${body}</div>`
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
  const { author, body } = req.body;
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  db.run(`INSERT INTO comments (author, body, created_at) VALUES ('${author}', '${body}', '${ts}')`);
  res.redirect('/board');
});

createDb().then((database) => {
  db = database;
  app.listen(PORT, () => console.log(`"Before" demo running → http://localhost:${PORT}`));
});
