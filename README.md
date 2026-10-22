# Antigravity Control Center

A modern, mobile-first local web dashboard and interactive chat interface for the **Google Antigravity CLI (`agy`)**. Cross-platform support for **Linux, macOS, Windows, and Android (Termux)**.

> [!CAUTION]
> **SECURITY WARNING:** Do not expose this server to the public internet without authentication.
> Antigravity Control Center is intended for local loopback use (`127.0.0.1` / `localhost`). Spawning CLI processes and running agent tools with internet-facing access without external authentication can expose your system to unauthorized access.

---

## Features

- **Interactive ChatGPT-Style Interface:** Multi-turn conversational chat with persistent session management, optimistic UI updates, animated thinking indicators, and streaming CLI output.
- **Collapsible Tool Call Accordions:** Inspect tool invocations (`read_file`, `edit_file`, `run_command`, etc.) with execution latency, argument inspection, and collapsible accordions.
- **File Uploads & Attachments:** Upload files up to 15MB via drag-and-drop or file picker; attached file paths are automatically injected into the agent prompt payload and rendered as file badges.
- **Focus Mode:** Full-screen 100dvh toggle hiding surrounding navigation bars for an immersive chat experience on mobile and desktop.
- **Markdown & Code Highlighting:** Assistant messages render GitHub-flavored Markdown, inline code, and syntax-highlighted code blocks with a one-click "Copy" button.
- **Conversation Library & Full-Text Search:** Browse previous conversations from `conversation_summaries.db` and search titles, prompts, and tool calls using SQLite FTS5 full-text search.
- **Live Activity Monitor:** Real-time presence detection and updates via WebSockets (`ws`), with automatic fallback polling for constrained environments (e.g., Android inotify limits).
- **Token Analytics:** Aggregates verified token counters (`input_tokens`, `output_tokens`, `cache_read_tokens`) across local transcript records.
- **Safe Settings Editor:** Safely edit `settings.json` with schema validation, conflict detection, and automatic atomic backup rollbacks (`settings.json.bak`).
- **Cross-Platform Process Manager:** Graceful interrupt handling with `SIGINT` on Linux, macOS, and Termux, and clean process tree termination with `taskkill` on Windows.

---

## Prerequisites

1. **Google Antigravity CLI (`agy`)**:
   - The `agy` command must be installed and accessible in your system's `PATH`.
   - Verify by running:
     ```bash
     agy --version
     ```
2. **Node.js**:
   - Node.js version **20.0.0 or higher** (tested on Node.js 20, 22, and 26 with built-in `node:sqlite`).
   - Verify by running:
     ```bash
     node --version
     ```
3. **Git**:
   - Required for git diff and repository status features.
   - Verify by running:
     ```bash
     git --version
     ```

---

## Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/<your-username>/antigravity-control-center.git
cd antigravity-control-center
npm install
```

### Platform-Specific Setup

#### Linux / macOS
No special configuration required. Simply run:
```bash
npm install
npm run build
```

#### Windows (PowerShell or Command Prompt)
Run in PowerShell or Command Prompt:
```powershell
npm install
npm run build
```
The server automatically uses `taskkill /pid <pid> /T /F` on Windows to cleanly terminate child process trees when stopping or interrupting sessions.

#### Android (Termux)
In Termux on Android (ARM64):
```bash
pkg update && pkg install nodejs-lts git
cd ~/antigravity-control-center
npm install
npm run build
```

---

## Running the Dashboard

### 1. Start the Production Server
```bash
npm start
```
The server will start at:
```
http://127.0.0.1:4300
```
Open this address in your browser (e.g. Chrome, Brave, Safari, Edge).

### 2. Development Mode
To run Vite dev server with frontend hot reload:
```bash
# Terminal 1: Backend server
npm run dev:server

# Terminal 2: Vite dev server
npm run dev
```

### 3. Background Execution on Android (Termux)
To keep the dashboard running in the background when multitasking on Android:
```bash
# Prevent Android from sleeping network and CPU
termux-wake-lock

# Start server in background
nohup node server/index.js > server.log 2>&1 &
```

To stop the background server:
```bash
pkill -f "node server/index.js"
```

---

## Running Tests

Antigravity Control Center includes a comprehensive test suite (25 unit and integration tests) using Node's built-in test runner (`node:test`):

```bash
npm test
```

Tests verify:
- Read-only queries against Antigravity databases
- CSRF token validation and HTTP Host header rebinding protection
- Canonical path traversal prevention and sensitive file masking
- Interactive multi-turn CLI session manager and model slug resolution
- User message sanitization and Windows/Unix attachment path parsing
- Settings validation and conflict detection
- Full HTTP and WebSocket lifecycle

---

## Configuration

Configuration can be customized via environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4300` | Port for the HTTP and WebSocket server |
| `HOST` | `127.0.0.1` | Host address to bind (defaults to loopback) |
| `AGY_DIR` | `~/.gemini/antigravity-cli` | Path to Antigravity CLI data directory |
| `WORKSPACE_ROOT` | User home directory (`os.homedir()`) | Allowed workspace root for file explorer and session execution |

---

## Security Model

- **Loopback Default:** Binds to `127.0.0.1` by default to prevent unauthorized network exposure.
- **Host Header Validation:** Strict host validation blocks DNS rebinding attacks.
- **CSRF Protection:** State-changing requests (`POST`, `PUT`, `DELETE`) require a valid `X-CSRF-Token` header.
- **Path Traversal Guards:** All workspace interactions resolve canonical paths and ensure operations remain strictly within `WORKSPACE_ROOT`.
- **Sensitive File Protection:** Automatic masking prevents inspecting or previewing private files (`.env`, `id_rsa`, `id_ed25519`, `.pem`, tokens, or private credentials).
- **Read-Only Database Access:** Connects to Antigravity's internal databases with strict read-only pragmas (`readOnly: true`).

---

## License

MIT License. See [LICENSE](LICENSE) for details.
