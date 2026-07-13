---
name: stelargb-secure-web-builder
description: Automatically checks and patches SQL Injection and XSS flaws (including DOM-based and second-order variants) during web code generation.
version: 1.1.0
commands:
  - name: /secure-build
    description: Generates secure, production-ready web components with SQLi/XSS protections applied.
---

# StelarGB — Secure Web Builder Skill (v1.1, SQLi + XSS scope)

## Purpose

This skill is a behavioral override for AI coding agents (Claude Code,
terminal agents, IDE copilots). By default, an LLM optimizes generated code
for "does it run", not "is it safe." This skill forces two specific
security properties into every piece of web-facing code the agent writes
or edits:

1. No SQL Injection (CWE-89) — including second-order and stacked-query
   variants, not just the obvious single-query case.
2. No Cross-Site Scripting (CWE-79) — across all three delivery
   mechanisms: reflected, stored, and DOM-based.

**v1.1 widens coverage within the same two-vulnerability scope.** v1.0
covered the textbook case (concatenated SQL, unescaped server-rendered
HTML). v1.1 adds DOM-based XSS, contextual output encoding, second-order
SQLi, and a "structural defense, not pattern matching" principle — gaps
that only show up once you look at how these vulnerabilities are actually
exploited, not just how they're textbook-defined. Later versions will
re-introduce the other pillars from the original PRD (auth, crypto,
secrets, dependency hygiene).

## Core principle: structural defense, not pattern matching

Do not defend against SQLi/XSS by writing input filters, regex blocklists,
character denylists, or relying on a WAF. All of these are bypassable —
case variation, encoding tricks, comment insertion, and alternate syntax
routinely defeat blocklist-style filters. The only durable defenses are:

- **SQLi:** the query parser never sees attacker input as syntax (bound
  parameters), full stop.
- **XSS:** attacker input is either never treated as markup/code (encoded
  for the context it lands in), or is stripped down by a real HTML
  sanitizer (not a regex) before being allowed as markup.

If you catch yourself writing `if (input.includes('<script'))` or
`input.replace(/union|select/gi, '')`, stop — that's a blocklist, and it
will be bypassed.

## When this skill applies

Trigger on any task that touches:
- A database query (raw SQL, an ORM, a query builder)
- Anything rendered into HTML/DOM from user-controlled input — including
  data that passed through storage first (see "second-order" below)
- Client-side JavaScript that reads from `location.hash`, `location.search`,
  `document.referrer`, `window.name`, `postMessage`, cookies, or
  `localStorage`/`sessionStorage` and writes it back into the page
- Templating engines, `innerHTML`/`dangerouslySetInnerHTML`-equivalents,
  string-built HTML responses, or any DOM-manipulation API

If a request is ambiguous about whether input is user-controlled, treat it
as user-controlled. Fail toward the safe default.

## Rule 1 — SQL Injection (CWE-89)

**Never build a query by concatenating or interpolating a variable into a
SQL string.** This includes template literals, `+` concatenation, and
`%`/`.format()`-style string interpolation, in any language.

Always use one of:
- Parameterized queries / bound placeholders (`?`, `$1`, `:name`) with the
  driver's own binding mechanism
- An ORM's query builder (Prisma, SQLAlchemy, ActiveRecord, Sequelize, etc.)
  used in its parameterized form — never its raw-SQL escape hatch with
  interpolated variables
- Prepared statements, stored procedures with bound parameters

```text
❌ `SELECT * FROM users WHERE username = '${username}'`
✅ db.prepare('SELECT * FROM users WHERE username = ?').get(username)
```

**Second-order SQLi:** a value that was safely bound on the way *into* the
database is not automatically safe on the way *out*. If a stored value
(a username, a product name, a JSON field) is later read back and used to
build a *different* query, that second query needs its own bound
parameters — the fact that the value passed through storage safely once
does not make it trusted.

**Stacked/multi-statement queries:** if the driver or ORM allows executing
multiple `;`-separated statements per call, disable that feature unless a
specific feature genuinely requires it. Combined with any injection point
it turns a data-read bug into arbitrary-statement execution.

**Defense in depth (apply in addition to parameterization, not instead of
it):**
- Database accounts used by the application should have the minimum
  privileges the app needs (no `DROP`/`ALTER`/admin grants for a
  read-mostly web app user).
- Disable or avoid dangerous engine features not in use (e.g. MySQL
  `LOAD_FILE`/`INTO OUTFILE`, MSSQL `xp_cmdshell`) at the database
  configuration level, not in application code.

If the agent is asked to review or refactor existing code and finds a
concatenated query, flag it and rewrite it to a bound-parameter form as
part of the task, even if not explicitly asked to fix security issues.

## Rule 2 — Cross-Site Scripting (CWE-79)

XSS has three delivery mechanisms and four encoding contexts. Getting the
server-rendered HTML-body case right and stopping there leaves the other
combinations open.

### 2a. Reflected & Stored XSS (server-rendered HTML)

**Never insert user-controlled text into HTML/DOM without contextual
output encoding**, and never use raw HTML-injection APIs on untrusted
input. The encoding rule depends on *where* the value lands, not just
whether it lands:

| Context | Example sink | Required encoding |
|---|---|---|
| HTML body | `<p>{value}</p>` | HTML-entity encode `& < > " '` |
| HTML attribute | `<div title="{value}">` | HTML-attribute encode (entity-encode all non-alphanumerics, always quote the attribute) |
| JavaScript string | `<script>var x = "{value}"</script>` | JS-string encode (`\`, quotes, `</script>` sequence) — or, better, don't interpolate into inline `<script>` at all; pass data via a JSON-encoded `<script type="application/json">` block instead |
| URL / URL parameter | `<a href="{value}">` | URL-encode, and reject/allow-list the scheme (block `javascript:`/`data:` — see open-redirect note below) |

One `escapeHtml()` function tuned for the HTML-body context is not
sufficient for the other three contexts — using it there gives a false
sense of safety.

- Server-rendered HTML: use a templating engine with autoescaping turned
  ON (e.g. `<%= %>` in EJS, Jinja2/Django's default autoescape) — never
  the "raw"/"safe"/unescaped variant for untrusted data. If hand-building
  HTML strings, escape per the table above based on context.
- Set a `Content-Security-Policy` header as defense in depth — but
  encoding is the primary control, not the CSP header.

```text
❌ res.send(`<p>${comment}</p>`)
✅ res.send(`<p>${escapeHtml(comment)}</p>`)
✅ <p>{comment}</p>   // React, escapes automatically
```

### 2b. DOM-based XSS (client-side JavaScript)

This is the case v1.0 missed: no server round-trip is needed if
client-side JS itself reads attacker-influenced data and writes it into a
dangerous sink.

**Sources to treat as untrusted in client-side code:**
`location.hash`, `location.search`, `location.href`, `document.referrer`,
`window.name`, `document.cookie`, `localStorage`/`sessionStorage`, and
the `data` of any `window.postMessage` listener that doesn't verify
`event.origin`.

**Sinks to avoid feeding with those sources, in order of danger:**
- Code-execution sinks — never: `eval(x)`, `new Function(x)`,
  `setTimeout(x, ...)` / `setInterval(x, ...)` with a *string* first
  argument (the function form is fine).
- HTML-injection sinks — never assign untrusted data directly:
  `el.innerHTML = x`, `el.outerHTML = x`, `document.write(x)`,
  `document.writeln(x)`, jQuery `$(el).html(x)`, `$.parseHTML(x)`,
  `$(x)` (jQuery's selector-or-HTML overload is a real trap when `x` can
  contain `<`).
- Navigation sinks — validate/allow-list before use, since they enable
  `javascript:`-URI execution or open redirects:
  `location.href = x`, `location.replace(x)`, `location.assign(x)`,
  `window.open(x)`.

**Safe replacements:**
- Prefer `el.textContent = x` (never interpreted as markup) over
  `innerHTML` whenever you're rendering text, not markup.
- In frameworks, use default text bindings (`{value}` in React, `{{ value }}`
  in Vue) — never `dangerouslySetInnerHTML` / `v-html` on untrusted input.
- If raw HTML rendering from untrusted input is a genuine product
  requirement (e.g. a rich-text comment box), sanitize with a real,
  actively-maintained sanitizer library (e.g. DOMPurify) — not a
  hand-written regex strip.
- For navigation/redirect targets, validate against an allow-list of
  known-safe paths/hosts rather than trying to blocklist dangerous
  schemes.
- For `postMessage` listeners, always check `event.origin` against an
  expected value before trusting `event.data`.

```text
❌ document.getElementById('name').innerHTML = new URLSearchParams(location.search).get('name');
✅ document.getElementById('name').textContent = new URLSearchParams(location.search).get('name');
```

## Verification checklist (apply before returning code to the user)

- [ ] Every SQL query is parameterized — grep for string interpolation next
      to `SELECT`/`INSERT`/`UPDATE`/`DELETE` and reject any hit.
- [ ] Values read back from storage and used to build a *new* query are
      also parameterized (second-order case), not assumed safe because
      they were bound once already.
- [ ] Multi-statement/stacked queries are disabled unless a specific
      feature requires them.
- [ ] Every place user input reaches HTML output is escaped for its actual
      context (body/attribute/JS-string/URL), or uses a framework's
      default-safe binding.
- [ ] No raw-HTML injection API (`innerHTML`, `dangerouslySetInnerHTML`,
      `v-html`, `document.write`, jQuery `.html()`/`$(x)`) is used on
      untrusted input without prior sanitization via a real library.
- [ ] No untrusted string reaches a code-execution sink (`eval`,
      `Function`, string-form `setTimeout`/`setInterval`).
- [ ] Navigation/redirect targets built from untrusted input are
      allow-listed, not blocklisted.
- [ ] No defense relies solely on a regex/blocklist filter — if one
      exists, it's in addition to a structural control, not instead of it.
- [ ] If the agent is unsure whether a value is user-controlled, it
      treated it as user-controlled.

## Example interaction

**User:** "Add a search endpoint that filters products by name."

**Agent, with this skill active, should produce:**

```javascript
app.get('/search', (req, res) => {
  const { q = '' } = req.query;
  const stmt = db.prepare('SELECT id, name, price FROM products WHERE name LIKE ?');
  const rows = stmt.all(`%${q}%`); // '%' concatenated into the *value*, not the query string
  res.json(rows); // JSON response — no HTML injection surface here
});
```

**Not:**

```javascript
app.get('/search', (req, res) => {
  const q = req.query.q;
  db.all(`SELECT id, name, price FROM products WHERE name LIKE '%${q}%'`, ...);
});
```

## See it in action

`../demo/before-app` and `../demo/after-app` are two runnable Express apps
— Claude's own real generations for the identical prompt, one with no
security prompt loaded and one with these rules loaded (see
`../demo/generation-transcripts/`). Run both locally and try the same
SQLi/XSS payloads against each; see `../demo/README.md`.

## Attribution

The DOM-XSS source/sink taxonomy and the "structural defense over
blocklists" framing in this v1.1 update were informed by reviewing the
vulnerability-class breakdowns in a public offensive-security skill
collection ([zakirkun/oh-my-open-pentest](https://github.com/zakirkun/oh-my-open-pentest)).
That project is built for authorized penetration testing and includes
active exploitation tooling; none of that exploitation content (payload
catalogs, WAF-bypass encodings, exfiltration scripts, etc.) is reproduced
here — only the underlying vulnerability taxonomy was used to make this
*defensive* rule set more complete.
