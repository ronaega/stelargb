# StelarGB

<p align="center">
  <img src="./logo.png" alt="StelarGB logo" width="180" />
</p>

<p align="center">
  <a href="https://www.anthropic.com/claude-code"><img src="https://img.shields.io/badge/Claude%20Code-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude Code" /></a>
  <a href="https://openai.com/"><img src="https://img.shields.io/badge/ChatGPT-412991?style=for-the-badge&logo=openai&logoColor=white" alt="ChatGPT" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" /></a>
  <a href="https://github.com/sql-js/sql.js"><img src="https://img.shields.io/badge/SQLite%20(WASM)-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite WASM" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" /></a>
</p>

**StelarGB** is an open-source, "secure-by-default" behavioral layer for AI
coding agents. LLMs optimize generated code for *does it run*, not *is it
safe*. StelarGB forces both cloud-based chat tools (ChatGPT, Claude Projects)
and local coding agents (Claude Code, terminal agents, IDE copilots) to
automatically avoid the two most common, most severe web vulnerabilities
during code generation.

> **v1.0 scope: SQL Injection + XSS only.** The original design covers five
> security pillars (auth, crypto, injection, secrets, dependencies); this
> first release deliberately narrows to the two highest-frequency,
> highest-impact classes so the rule set stays small enough to verify and
> test. See [Roadmap](#roadmap). (Note: "v1.0" here is the project's
> *scope* decision — the rules themselves are up to v1.2; see
> [Document Matrix](#document-matrix).)

---

## Table of Contents

- [Why StelarGB](#why-stelargb)
- [v1.0 Scope](#v10-scope)
- [Repository Structure](#repository-structure)
- [Quick Start — Web UI (no install)](#quick-start--web-ui-no-install)
- [Quick Start — CLI / Claude Code (install)](#quick-start--cli--claude-code-install)
- [See It Work: Comparison Demo](#see-it-work-comparison-demo)
- [Document Matrix](#document-matrix)
- [Roadmap](#roadmap)
- [Disclaimer](#disclaimer)

---

## Why StelarGB

Ask any LLM for a login form or a comment box and, unless told otherwise,
you'll typically get a string-concatenated SQL query and unescaped HTML
output — both are textbook SQL Injection (CWE-89) and Cross-Site Scripting
(CWE-79). StelarGB is not a scanner that finds this after the fact; it's a
prompt/skill layer that stops the AI from writing it in the first place.

Design principles:

- **Secure by default, not by request.** The rules apply automatically to
  any web-facing code the agent touches — no need to ask "is this secure?"
  every time.
- **Two delivery mechanisms, one rule set.** The exact same two rules are
  expressed as copy-paste text for web chat UIs, and as an installable
  Claude Code skill for local agents.
- **Provable, not just promised.** The `demo/` folder is a real, runnable
  before/after app pair so you can see the exact same payload succeed
  against the "before" code and fail against the "after" code.

## v1.0 Scope

| Rule | Vulnerability Class | CWE |
|---|---|---|
| Parameterized queries only | SQL Injection | CWE-89 |
| Contextual output encoding | Cross-Site Scripting | CWE-79 |

Everything else — auth enforcement, modern cryptography, secret/debug-flag
suppression, dependency hygiene, and any vulnerability class beyond SQLi/XSS
— is intentionally deferred to a later release (original design doc is
kept locally, gitignored — not published to this repo). See [Roadmap](#roadmap).

## Repository Structure

```text
StelarGB/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Boots both demo apps + checks core files exist
├── stelargb-secure-web-builder/
│   └── SKILL.md                   # Claude Code / terminal-agent skill (SQLi+XSS rules)
├── web-prompts/
│   ├── claude-projects.md         # Copy/paste system prompt for Claude Projects
│   └── openai-custom-gpt.md       # Copy/paste instructions for ChatGPT Custom GPTs
├── demo/
│   ├── generation-transcripts/    # The prompt + Claude's raw before/after responses
│   ├── before-app/                # Claude's real, unprompted generation: string-concat SQL, raw HTML
│   ├── after-app/                 # Claude's real generation with the StelarGB prompt loaded
│   └── README.md                  # How to run both and try the exact same payloads
├── .gitignore                      # Excludes local-only files (incl. internal PRD doc)
├── LICENSE                        # MIT
└── README.md                      # This file
```

## Quick Start — Web UI (no install)

For ChatGPT Plus / Custom GPTs or Claude Projects — no server, no terminal.

1. Open [`web-prompts/claude-projects.md`](./web-prompts/claude-projects.md)
   (for Claude Projects) or [`web-prompts/openai-custom-gpt.md`](./web-prompts/openai-custom-gpt.md)
   (for a ChatGPT Custom GPT).
2. Copy the contents of the fenced code block into the tool's
   Instructions / System Prompt field.
3. Start asking for web-facing code as normal — SQLi/XSS-safe patterns
   are now the default.

## Quick Start — CLI / Claude Code (install)

```bash
git clone https://github.com/ronaega/stelargb.git
mkdir -p ~/.claude/skills
cp -r stelargb/stelargb-secure-web-builder ~/.claude/skills/stelargb-secure-web-builder
```

Or drop `stelargb-secure-web-builder/` directly into a single project's workspace if
you don't want it applied globally. Claude Code will pick up the
`SKILL.md` frontmatter automatically.

## See It Work: Comparison Demo

`demo/` contains two Express apps built on a real SQLite engine (`sql.js`,
compiled to WebAssembly) that are **Claude's actual generations** for the
identical request — one produced with no security prompt loaded, one
produced with the StelarGB prompt loaded as system instructions. Nothing was
hand-edited afterward; see `demo/generation-transcripts/` for the raw
transcripts.

```bash
cd demo/before-app && npm install && npm start   # http://localhost:4001
cd demo/after-app  && npm install && npm start   # http://localhost:4002
```

Log into both with username `admin' --` and any password. The vulnerable
app logs you in as `admin`; the secure app correctly rejects it. Then post
`<script>alert(document.cookie)</script>` as a comment on both and compare
the rendered HTML. Full walkthrough in [`demo/README.md`](./demo/README.md).

## Document Matrix

| File | Version | Purpose |
|---|---|---|
| [`web-prompts/openai-custom-gpt.md`](./web-prompts/openai-custom-gpt.md) | v1.2 | ChatGPT Custom GPT instructions; includes a prompt-injection defense block. |
| [`web-prompts/claude-projects.md`](./web-prompts/claude-projects.md) | v1.2 | Claude Projects system prompt using `<security_guardrails>` / `<execution_protocol>` XML blocks. |
| [`stelargb-secure-web-builder/SKILL.md`](./stelargb-secure-web-builder/SKILL.md) | v1.2 | Standardized YAML-frontmatter skill file for Claude Code / terminal agents. |

All three are kept in sync at the same rule version; see each file's
changelog notes at the top for what changed between versions.

## Roadmap

Deliberately **out of scope for v1.0** (kept out of this repo's git history —
tracked only in the internal, gitignored design doc):

- Authentication enforcement (server-side session/state verification rules)
- Modern cryptography enforcement (reject MD5/SHA1, require Argon2id/bcrypt)
- Secret/debug-flag suppression (hardcoded API keys, `DEBUG=true`)
- Dependency hygiene rules (unpinned/unvetted packages)
- Additional vulnerability classes beyond SQLi/XSS

## Disclaimer

StelarGB's `demo/before-app` is **intentionally insecure** and provided
for local, offline education only. Do not deploy it anywhere reachable from
the internet. The prompts and skill files are provided as-is; always review
AI-generated code before deploying it, and treat StelarGB as one layer of
defense, not a substitute for code review or a real security audit.
