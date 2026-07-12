## Project Name: StelarGB
**Author:** AI Collaboration Team  
**Status:** Ready for Implementation  
**Target Release:** v1.0.0  

---

## 1. Executive Summary & Vision
`StelarGB` is an open-source security framework designed to solve a critical flaw in modern generative AI: **Large Language Models (LLMs) optimize code for speed and execution, not security.** 

This project provides a "Secure-by-Default" behavioral layer for AI agents. It forces both cloud-based LLMs (OpenAI GPT, Anthropic Claude UI) and local development tools (CLIs, IDE agents) to automatically eliminate severe web vulnerabilities (XSS, SQLi, Broken Auth, Hardcoded Secrets) during code generation.

---

## 2. Core Personas & Use Cases

### Persona A: The Web UI Creator (No-Code/Low-Code)
* **Profile:** Small business owners, designers, or product managers using ChatGPT Plus or Claude Pro interfaces to prototype websites.
* **Need:** A copy-paste framework that instantly overrides standard, insecure LLM defaults without needing technical server configuration.

### Persona B: The Terminal Developer (CLI/Desktop)
* **Profile:** Software engineers using terminal-based AI agents (e.g., Claude Code, native CLI wrappers, or local open-source agents).
* **Need:** An installable, system-level AI "Skill" that monitors project workspace context and automatically formats all code outputs to match production security standards.

---

## 3. Scope & System Architecture

The project splits into two distribution channels (Schemas) served out of a single GitHub repository.

Kodu dikkatli kullanın.[ GitHub Repository: StelarGB ]|+--------------+--------------+|                             |[ SCHEMA 1: Web UI ]         [ SCHEMA 2: CLI/Desktop ]|                             |├── Copy/Paste .md Files      ├── Installable Folder (secure-web-skill)└── Direct "Raw" Text Links   └── Standardized SKILL.md + Configuration
### Schema 1: Web UI Platform Integration
* **Mechanism:** Markdown-based instructional templates optimized for high context retention inside LLM system-prompt fields.
* **Target Delivery:** Optimized text files for OpenAI Custom GPT Instructions and Anthropic Claude Project System Prompts.

### Schema 2: CLI & Local Desktop Integration
* **Mechanism:** A structured, terminal-compliant directory structure using standardized YAML frontmatter metadata.
* **Target Delivery:** A drop-in folder structure compatible with local project workspaces and global system paths (`~/.claude/skills/`).

---

## 4. Technical Requirements & Security Baseline

Any prompt or configuration asset produced in this repository must explicitly enforce the following five security pillars:

1. **Authentication Enforcement:** Absolute prohibition of client-side-only access controls. Forced implementation of server-side state verification for multi-step processes.
2. **Modern Cryptography:** Hard rejection of legacy algorithms (`MD5`, `SHA1`). Absolute requirement to default to modern primitives (`Argon2id`, `bcrypt`).
3. **Injection and XSS Shielding:** Explicit instruction to use contextual output encoding on the frontend, and strict parameterized queries/ORMs on the backend.
4. **Information Leakage Prevention:** Automated suppression of debug verbose flags (`DEBUG=false`) and strict exclusion of hardcoded API keys or environment secrets.
5. **Dependency Hygiene:** Rules preventing the AI from importing unvetted, unpinned, or outdated third-party open-source packages.

---

## 5. Repository Directory Structure

To deliver both schemas effectively, the repository must be structured exactly as follows:

```text
├── .github/                 # Automated repository actions
│   └── workflows/
├── secure-web-skill/        # SCHEMA 2: CLI & Desktop Files
│   └── SKILL.md             # Standardized AI terminal instruction file
├── web-prompts/             # SCHEMA 1: Web Copy/Paste Files
│   ├── claude-projects.md   # System Prompt for Anthropic Claude UI
│   └── openai-custom-gpt.md # System Prompt for ChatGPT Custom GPTs
├── LICENSE                  # MIT License File
└── README.md                # System Homepage & Universal User Guide
```

---

## 6. Document Matrix (Core Asset Specifications)

### 6.1 `web-prompts/openai-custom-gpt.md`
* Must be formatted for the ChatGPT "Instructions" text boundaries.
* Must include an explicit Prompt Injection Defense block at the bottom to prevent system prompt extraction attacks.

### 6.2 `web-prompts/claude-projects.md`
* Must use clear XML block formatting tags (`<security_guardrails>`, `<execution_protocol>`) as preferred by Anthropic’s Claude models for optimal context parsing.

### 6.3 `secure-web-skill/SKILL.md`
* Must begin with standard YAML frontmatter for CLI parsing:
  ```yaml
  ---
  name: StelarGB-secure-web-builder
  description: Automatically checks and patches web security flaws during generation.
  version: 1.0.0
  commands:
    - name: /secure-build
      description: Generates secure, production-ready web components.
  ---
  ```

---

## 7. Release & Deployment Checklist

- [ ] Create public GitHub Repository under the name `StelarGB`.
- [ ] Initialize repository with an **MIT License** to maximize developer distribution.
- [ ] Populate `web-prompts/` directory with tested core prompts.
- [ ] Populate `secure-web-skill/` directory with the standard `SKILL.md` configuration.
- [ ] Draft user-facing `README.md` containing direct links to the raw text assets and clear terminal commands (`git clone`) for local setup.
- [ ] Perform a validation test run on both ChatGPT Plus and Claude Code to verify that the security rules are actively enforced.
EOF