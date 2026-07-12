# StelarGB Comparison Demo

Two tiny, identical Express apps — a mini login + comment board — that
differ in exactly one way: **how they handle user input.**

| | `vulnerable-app/` | `secure-app/` |
|---|---|---|
| SQL queries | String-concatenated | Parameterized (bound `?` placeholders) |
| HTML rendering | Raw, unescaped | HTML-escaped |
| Everything else | identical | identical |

Both use [`sql.js`](https://github.com/sql-js/sql.js) — a real SQLite
engine compiled to WebAssembly — so the SQL injection you'll see is a
genuine SQL injection against a genuine SQL engine, not a simulation.

> ⚠️ `vulnerable-app/` is intentionally insecure. Run it only on
> `localhost`, only for this demo, and never deploy it anywhere
> reachable from the internet.

## Running it

Each app is independent and runs on its own port.

```bash
# Terminal 1
cd demo/vulnerable-app
npm install
npm start        # → http://localhost:4001

# Terminal 2
cd demo/secure-app
npm install
npm start         # → http://localhost:4002
```

## Try it: SQL Injection

Seeded user: `admin` / `sup3rSecret!`

1. Open `http://localhost:4001` (vulnerable). Log in with:
   - Username: `admin' --`
   - Password: anything at all
   - You'll be logged in as `admin` without knowing the real password —
     the page even shows you the exact SQL string that ran.
2. Open `http://localhost:4002` (secure). Try the exact same input.
   You'll get "Invalid credentials" — the value is bound as data, never
   parsed as SQL syntax, so the trailing `--` does nothing.

## Try it: Cross-Site Scripting

1. On either app, go to `/board`.
2. Post a comment with the name/body:
   ```
   <script>alert(document.cookie)</script>
   ```
3. On `vulnerable-app`, the script tag is inserted into the page as
   real, executable HTML — view source and you'll see an unescaped
   `<script>` element sitting in the DOM (a real browser would execute
   it; curl/view-source just shows you it's there, unescaped).
4. On `secure-app`, the same input renders as inert text —
   `&lt;script&gt;alert(document.cookie)&lt;/script&gt;` — visible on
   the page as literal text, not executed.

## Reading the code

Open `vulnerable-app/server.js` and `secure-app/server.js` side by side.
The route structure is identical; only the query-building and
HTML-rendering lines differ. That diff is exactly what
`secure-web-skill/SKILL.md` and the two `web-prompts/*.md` files force an
AI agent to produce automatically, instead of by accident.
