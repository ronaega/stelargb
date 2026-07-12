---
name: StelarGB-secure-web-builder
description: Automatically checks and patches SQL Injection and XSS flaws during web code generation.
version: 1.0.0
commands:
  - name: /secure-build
    description: Generates secure, production-ready web components with SQLi/XSS protections applied.
---

# StelarGB — Secure Web Builder Skill (v1.0, SQLi + XSS scope)

## Purpose

This skill is a behavioral override for AI coding agents (Claude Code, terminal
agents, IDE copilots). By default, an LLM optimizes generated code for
"does it run", not "is it safe." This skill forces two specific security
properties into every piece of web-facing code the agent writes or edits:

1. No SQL Injection (CWE-89)
2. No Cross-Site Scripting (CWE-79)

This is the **v1.0 scope on purpose** — later versions will re-introduce the
other pillars from the original PRD (auth, crypto, secrets, dependency
hygiene). Keeping v1.0 to two vulnerability classes makes the rule set easy
to verify, easy to test against the `demo/` apps in this repo, and easy to
extend later without breaking what already works.

## When this skill applies

Trigger on any task that touches:
- A database query (raw SQL, an ORM, a query builder)
- Anything rendered into HTML/DOM from user-controlled input (form fields,
  URL params, headers, uploaded file names, API responses fed back to a
  browser)
- Templating engines, `innerHTML`/`dangerouslySetInnerHTML`-equivalents,
  string-built HTML responses

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

If the agent is asked to review or refactor existing code and finds a
concatenated query, flag it and rewrite it to a bound-parameter form as
part of the task, even if not explicitly asked to fix security issues.

## Rule 2 — Cross-Site Scripting (CWE-79)

**Never insert user-controlled text into HTML/DOM without contextual output
encoding**, and never use raw HTML-injection APIs on untrusted input.

- Server-rendered HTML: escape `& < > " '` before interpolating into a
  string-built response, or use a templating engine with autoescaping
  turned ON (e.g. `<%= %>` in EJS, Jinja2's default autoescape, Django
  templates) — never the "raw"/"safe"/unescaped variant for untrusted data.
- Client-side rendering (React/Vue/etc.): use the framework's normal text
  binding (`{value}`, `{{ value }}`), which escapes by default. Do not use
  `dangerouslySetInnerHTML`, `v-html`, or `.innerHTML =` on untrusted input.
  If raw HTML rendering is genuinely required, sanitize with a vetted
  library (e.g. DOMPurify) first.
- Set a `Content-Type` and, where the stack supports it, a
  `Content-Security-Policy` header as defense in depth — but encoding is
  the primary control, not the CSP header.

```text
❌ res.send(`<p>${comment}</p>`)
✅ res.send(`<p>${escapeHtml(comment)}</p>`)
✅ <p>{comment}</p>   // React, escapes automatically
```

## Verification checklist (apply before returning code to the user)

- [ ] Every SQL query is parameterized — grep for string interpolation next
      to `SELECT`/`INSERT`/`UPDATE`/`DELETE` and reject any hit.
- [ ] Every place user input reaches HTML output is escaped or uses a
      framework's default-safe binding.
- [ ] No raw-HTML injection API (`innerHTML`, `dangerouslySetInnerHTML`,
      `v-html`, `|safe`, `render_template_string`) is used on untrusted
      input without prior sanitization.
- [ ] If the agent is unsure whether a value is user-controlled, it treated
      it as user-controlled.

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

`../demo/vulnerable-app` and `../demo/secure-app` are two runnable Express
apps with identical features — one written the way an LLM would write it
with no guardrails, one written under these two rules. Run both locally
and try the same SQLi/XSS payloads against each; see `../demo/README.md`.
