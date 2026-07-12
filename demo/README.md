# StelarGB Comparison Demo

Two runnable Express apps that are **Claude's own real generations**, produced
from the exact same prompt under two different conditions — not hand-written
to make a point. See `generation-transcripts/` for the raw transcripts.

| | `before-app/` | `after-app/` |
|---|---|---|
| System prompt used | none | `web-prompts/claude-projects.md` |
| SQL queries | String-concatenated | Parameterized (bound `?` placeholders) |
| HTML rendering | Raw, unescaped | HTML-escaped |
| Route structure | identical | identical |

Both use [`sql.js`](https://github.com/sql-js/sql.js) — a real SQLite engine
compiled to WebAssembly — so the SQL injection you'll see is a genuine SQL
injection against a genuine SQL engine, not a simulation. The seed data
(`db.js`) is identical infrastructure shared by both apps and wasn't part of
either generation.

> ⚠️ `before-app/` is a genuine, unguarded generation and is intentionally
> insecure. Run it only on `localhost`, only for this demo, and never deploy
> it anywhere reachable from the internet.

## How these were actually produced

1. The exact same request (see `generation-transcripts/prompt.md`) was sent
   to Claude twice in the same conversation.
2. `before-no-skill.md` — sent with no security instructions loaded at all;
   this is Claude's default, unprompted response.
3. `after-with-skill.md` — sent with the full contents of
   `web-prompts/claude-projects.md` loaded as the system prompt first.
4. The code blocks from both raw responses were copied as-is into
   `before-app/server.js` and `after-app/server.js`, then wired up to the
   shared `db.js` seed data (which adds a `created_at` column the original,
   more minimal transcripts didn't need) so both apps actually run.

Nothing about the login/query/rendering logic was edited after generation —
what you're running is what Claude actually wrote under each condition.

## Running it

Each app is independent and runs on its own port.

```bash
# Terminal 1
cd demo/before-app
npm install
npm start        # → http://localhost:4001

# Terminal 2
cd demo/after-app
npm install
npm start         # → http://localhost:4002
```

## Try it: SQL Injection

Seeded user: `admin` / `sup3rSecret!`

1. Open `http://localhost:4001` (before). Log in with:
   - Username: `admin' --`
   - Password: anything at all
   - You'll be logged in as `admin` without knowing the real password — the
     page even shows you the exact SQL string that ran.
2. Open `http://localhost:4002` (after). Try the exact same input. You'll get
   "Invalid login" — the value is bound as data, never parsed as SQL syntax,
   so the trailing `--` does nothing.

## Try it: Cross-Site Scripting

1. On either app, go to `/board`.
2. Post a comment with the body:
   ```
   <script>alert(document.cookie)</script>
   ```
3. On `before-app`, view source — the script tag sits in the page as real,
   executable HTML (a real browser would run it).
4. On `after-app`, the same input renders as inert text —
   `&lt;script&gt;alert(document.cookie)&lt;/script&gt;` — visible as
   literal text, not executed.

## Reading the code

Open `before-app/server.js` and `after-app/server.js` side by side. The route
structure is nearly identical; only the query-building and HTML-rendering
lines differ — because that's the actual, observed diff between what Claude
writes with and without the StelarGB prompt loaded.
