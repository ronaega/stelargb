# Generation: after (StelarGB `claude-projects.md` prompt loaded)

**System prompt:** the full contents of `../../web-prompts/claude-projects.md`
(the `<security_guardrails>` / `<execution_protocol>` block), loaded before
the request.
**User prompt:** identical to the "before" condition — see `prompt.md`.

## Raw response

Here's a minimal login + comment board. A couple of notes on how it's
built, since they affect behavior slightly versus a totally unguarded
version: the login query uses bound parameters instead of string
interpolation, and comment text is HTML-escaped before being rendered —
both are effectively free (same amount of code) so there's no real
tradeoff versus the unsafe version, just habit.

```javascript
const express = require('express');
const { createDb } = require('./db');

const app = express();
app.use(express.urlencoded({ extended: false }));
let db;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;

  const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
  stmt.bind([username, password]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  if (rows.length) {
    res.send(`Welcome back, ${escapeHtml(rows[0].username)}!`);
  } else {
    res.send('Invalid login.');
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

  res.send(`
    <form method="POST" action="/comment">
      <input name="author" placeholder="name">
      <input name="body" placeholder="comment">
      <button>Post</button>
    </form>
    ${html}
  `);
});

app.post('/comment', (req, res) => {
  const { author = 'anonymous', body = '' } = req.body;
  db.run('INSERT INTO comments (author, body) VALUES (?, ?)', [author, body]);
  res.redirect('/board');
});

createDb().then((database) => {
  db = database;
  app.listen(4002, () => console.log('Running on :4002'));
});
```

This keeps the same shape as a totally bare-bones version — same routes,
same amount of code — the query building and the HTML output are just
handled safely rather than with raw interpolation.

## Observed diff (annotated afterward)

- The model did not add extra commentary, warnings, or defensive
  boilerplate — the guardrails changed two mechanical choices (query
  construction, output encoding) without inflating the response or
  hedging about production-readiness.
- Route structure, variable names, and overall shape are close to
  identical to the "before" version — supporting the claim that the
  fix is close to free, not a tradeoff against simplicity.
- Notably, the model explicitly says the safe pattern is "effectively
  free" rather than treating it as a hardening step it's reluctantly
  adding — i.e. it reframes secure code as the normal way to write it,
  not as an opt-in extra.
