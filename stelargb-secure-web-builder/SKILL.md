---
name: stelargb-secure-web-builder
description: Automatically checks and patches SQL Injection and XSS flaws across DBMS dialects, delivery mechanisms, and encoding contexts during web code generation.
version: 1.2.0
commands:
  - name: /secure-build
    description: Generates secure, production-ready web components with SQLi/XSS protections applied.
---

# StelarGB — Secure Web Builder Skill (v1.2, SQLi + XSS scope)

## Purpose

This skill is a behavioral override for AI coding agents (Claude Code,
terminal agents, IDE copilots). By default, an LLM optimizes generated code
for "does it run", not "is it safe." This skill forces two specific
security properties into every piece of web-facing code the agent writes
or edits:

1. No SQL Injection (CWE-89) — including second-order, stacked-query, and
   identifier-injection variants, across common DBMS dialects, not just
   the obvious single-query MySQL/Postgres case.
2. No Cross-Site Scripting (CWE-79) — across all three delivery
   mechanisms (reflected, stored, DOM-based), including injection via
   rendered file uploads (SVG/Markdown/CSS), not just inline HTML.

**v1.2 widens coverage within the same two-vulnerability scope.** v1.0
covered the textbook case (concatenated SQL, unescaped server-rendered
HTML). v1.1 added DOM-based XSS, contextual output encoding, second-order
SQLi, and a "structural defense, not pattern matching" principle. v1.2
adds identifier-injection (a real gap in "just use placeholders" advice),
untrusted-input sources beyond the request body/query string, dangerous
URI schemes beyond `javascript:`, rendered-file injection vectors, and a
note on sanitizer-bypass via HTML mutation. Later versions will
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

**Identifier injection (a gap "just use bound parameters" doesn't cover):**
bound placeholders (`?`, `$1`) can only parameterize *values* — they
cannot parameterize table names, column names, or `ORDER BY`/`ASC`/`DESC`
direction, because those are SQL syntax, not data. If a table name, column
name, or sort direction is ever derived from user input (e.g. a
"sort by ___" feature), it must be validated against a hardcoded
allow-list of known-safe identifiers before being interpolated — never
passed through as-is, and never "sanitized" by stripping characters.

```text
❌ db.exec(`SELECT * FROM products ORDER BY ${req.query.sort}`)
✅ const allowed = ['name', 'price', 'created_at'];
   const sort = allowed.includes(req.query.sort) ? req.query.sort : 'name';
   db.exec(`SELECT * FROM products ORDER BY ${sort}`) // safe: sort can only be a literal from the allow-list
```

**Untrusted input isn't just `req.body`/`req.query`:** headers
(`User-Agent`, `X-Forwarded-For`, `Referer`), cookies, and values relayed
from another internal service that ultimately originated from a user are
just as capable of carrying an injection payload if they ever reach a
query. Apply the same parameterization rule regardless of which part of
the request a value came from.

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
- Don't return raw `SELECT *` results to the client — return only the
  columns the feature needs. This limits blast radius if a query-shape
  bug ever does leak extra data.
- Suppress verbose/raw database error messages from reaching the client
  in any environment reachable by users; log them server-side instead.
  This applies regardless of DBMS (MySQL, PostgreSQL, MSSQL, Oracle,
  SQLite all have distinct error-message formats attackers use for
  fingerprinting, but the fix is the same: don't expose them).

If the agent is asked to review or refactor existing code and finds a
concatenated query, flag it and rewrite it to a bound-parameter form as
part of the task, even if not explicitly asked to fix security issues.
This rule applies the same way regardless of which SQL dialect is in use.

## Rule 2 — Cross-Site Scripting (CWE-79)

XSS has three delivery mechanisms (reflected, stored, DOM-based), four
encoding contexts (body/attribute/JS-string/URL), and several additional
surfaces (rendered file uploads, internal-tool consumers) that are easy to
miss if you only handle the textbook server-rendered HTML-body case.

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
| URL / URL parameter | `<a href="{value}">` | URL-encode, and allow-list the scheme (see URI scheme note below) |

One `escapeHtml()` function tuned for the HTML-body context is not
sufficient for the other three contexts — using it there gives a false
sense of safety.

**Don't rely on a tag-name or attribute-name blocklist as the defense.**
Filtering only `<script>` (or only lowercase `<script>`) leaves every
other injection-capable tag/attribute open: `<img onerror=...>`,
`<svg onload=...>`, `<body onload=...>`, `<iframe>`, `<SCRIPT>` (case
variation), and dozens more all execute script without the literal string
"script" appearing as a standalone tag. This is exactly why context-aware
encoding (above) is the primary control — it makes the specific tag/case
used irrelevant, because the `<` itself never reaches the parser as markup.

**URI scheme allow-listing:** when a user-controlled value is used as a
URL (an `href`, a redirect target, an image `src`), allow-list the scheme
to `http:`/`https:` (and `mailto:` if genuinely needed) rather than trying
to block dangerous ones — `javascript:`, `data:`, and `vbscript:` (legacy
IE) can all execute code or exfiltrate data when used as a href/src, and
new dangerous schemes can be introduced by browsers over time, so
allow-listing what's expected is more durable than blocking what's known.

- Server-rendered HTML: use a templating engine with autoescaping turned
  ON (e.g. `<%= %>` in EJS, Jinja2/Django's default autoescape) — never
  the "raw"/"safe"/unescaped variant for untrusted data. If hand-building
  HTML strings, escape per the table above based on context.
- Set a `Content-Security-Policy` header as defense in depth — but
  encoding is the primary control, not the CSP header. A `frame-ancestors`
  directive also mitigates UI-redressing/clickjacking of pages that
  render user content.

```text
❌ res.send(`<p>${comment}</p>`)
✅ res.send(`<p>${escapeHtml(comment)}</p>`)
✅ <p>{comment}</p>   // React, escapes automatically
```

### 2c. XSS via rendered file uploads

If the application lets users upload files that get rendered back —
**SVG images, Markdown converted to HTML, CSS, or XML** — each of these
formats can carry executable content of its own (SVG and XML can embed
`<script>`/event handlers; Markdown-to-HTML converters can pass raw HTML
through if not configured to escape it; CSS historically allowed
`expression()`/`url(javascript:...)` in legacy engines). Treat "renders a
file the user uploaded" as an HTML-output context requiring the same
sanitization as any other untrusted HTML — don't assume a non-HTML file
type is automatically inert. Serve user-uploaded files that don't need to
be rendered inline from a separate, cookie-less origin/domain where
possible, so even a successful injection can't access the main app's
session.

### 2d. Any consumer of the data is a render context, not just the public page

If user-submitted content is later viewed somewhere else — an admin
dashboard, a support/back-office tool, a log viewer, an email digest —
that view needs the exact same output encoding as the public-facing page.
A common gap is escaping output on the public page correctly while an
internal tool renders the same underlying data with `innerHTML`/raw
templating and no encoding at all, because "it's just internal."

### 2e. DOM-based XSS (client-side JavaScript)

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
  hand-written regex strip. Keep the sanitizer library updated: browsers'
  own HTML parsing can "mutate" markup on re-parse (mutation XSS/mXSS) in
  ways that reactivate content a sanitizer correctly stripped, and fixes
  for known mutation quirks ship as library updates.
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
- [ ] Any user-influenced table name, column name, or sort direction is
      checked against a hardcoded allow-list, not interpolated directly
      or passed through a placeholder (placeholders can't bind identifiers).
- [ ] Values from headers/cookies/relayed-service data, not just the
      request body/query string, are parameterized the same as any other
      input if they reach a query.
- [ ] Multi-statement/stacked queries are disabled unless a specific
      feature requires them.
- [ ] Raw database error messages are not returned to the client.
- [ ] Every place user input reaches HTML output is escaped for its actual
      context (body/attribute/JS-string/URL), or uses a framework's
      default-safe binding.
- [ ] No raw-HTML injection API (`innerHTML`, `dangerouslySetInnerHTML`,
      `v-html`, `document.write`, jQuery `.html()`/`$(x)`) is used on
      untrusted input without prior sanitization via a real, maintained
      library.
- [ ] No untrusted string reaches a code-execution sink (`eval`,
      `Function`, string-form `setTimeout`/`setInterval`).
- [ ] Navigation/redirect/URL-attribute targets built from untrusted input
      are scheme-allow-listed (`http`/`https` only, typically), not
      blocklisted against known-bad schemes.
- [ ] If the app renders uploaded SVG/Markdown/CSS/XML, that render path
      is sanitized the same as any other untrusted HTML output.
- [ ] Every consumer of user-submitted data — public page, admin
      dashboard, internal tool, log viewer — encodes output the same way;
      "internal-only" is not an exemption.
- [ ] No defense relies solely on a regex/blocklist filter (tag names,
      keywords, or character denylists) — if one exists, it's in addition
      to a structural control, not instead of it.
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

This rule set's coverage was widened by reviewing the vulnerability-class
taxonomies in two public security references — not by reproducing their
content, only by using their category breakdowns to check for gaps:

- **DOM-XSS source/sink taxonomy and "structural defense over
  blocklists" framing (v1.1):** informed by
  [zakirkun/oh-my-open-pentest](https://github.com/zakirkun/oh-my-open-pentest),
  a penetration-testing skill collection with active exploitation
  tooling. None of that exploitation content (payload catalogs,
  WAF-bypass encodings, exfiltration scripts) is reproduced here.
- **Identifier injection, untrusted-source scope, URI-scheme
  allow-listing, rendered-file XSS vectors, and mutation XSS (v1.2):**
  informed by the [SQL Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/SQL%20Injection)
  and [XSS Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XSS%20Injection)
  sections of PayloadsAllTheThings, a widely-used penetration-testing
  payload reference. Only the category/technique names (UNION-based,
  blind, DBMS-specific dialects, URI wrappers, file-format vectors, etc.)
  were used to check this rule set's coverage — no payload strings,
  wordlists, or exploitation code from that repository are included here.
