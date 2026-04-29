# Architecture & Context 🏗️

This document provides technical context for AI agents working on this codebase.

## System Overview

**Agent Skill Loader** is a Node.js-based MCP Server. It does not maintain a persistent database; it scans the file system in real-time to discover "Skills" and exposes them via both MCP Tools and MCP Prompts.

### Core Definitions

- **Skill**: A directory containing a `SKILL.md` file. The `SKILL.md` contains instructions (system prompt fragment) for the AI.
- **Skill Library**: A root directory containing multiple Skill directories.

## Logic Flow (`src/index.ts`)

### Initialization

1. Server starts using `StdioServerTransport`.
2. Loads configuration from `.env` (manual parse — dotenv corrupts MCP stdio).
3. Reads `MCP_SKILL_PATHS` env var for additional scan paths.
4. Registers MCP Prompts capability + handlers (dynamic, FS-scan on each call).
5. Registers 5 MCP Tools.
6. Connects to transport, then starts chokidar file watcher (unless `MCP_NO_WATCH=1`).

### MCP Prompts

The server declares `capabilities: { prompts: { listChanged: true } }` and registers two low-level handlers:

- **`prompts/list`**: Scans all skill paths, returns `{ name, description }` per skill. Clients see these as slash commands.
- **`prompts/get`**: Finds skill by name, reads `SKILL.md`, returns content as a `user` message. Client injects into conversation context.

Handlers use `server.server.setRequestHandler()` (bypassing `McpServer.registerPrompt()`) so they dynamically scan the FS on every call — same source of truth as the tools.

### File Watcher

After transport connect, `chokidar` watches all effective skill paths:

- Events: `add`, `unlink`, `addDir`, `unlinkDir`
- Debounce: 100ms (coalesces rapid events)
- On change: calls `server.sendPromptListChanged()` → clients refresh their prompt list
- Disable: `MCP_NO_WATCH=1`

### Tool: `list_skills`

- Recursively scans `SEARCH_PATHS`.
- Looks for `SKILL.md`.
- Parses frontmatter (YAML-style) to extract `description`.
- Optional `query` parameter: case-insensitive substring filter on name + description.
- Returns simplified JSON list (saves context tokens).

### Tool: `read_skill`

- Finds the specific skill by name.
- Reads `SKILL.md`.
- Returns raw text content.

### Tool: `install_skill`

- Locates the source directory.
- **Security**: Validates that target path is within current workspace.
- Uses `fs.cpSync` to recursively copy content.
- Annotated `destructiveHint: true`.

### Tool: `manage_search_paths`

- Reads/writes `skill-paths.json` in workspace root.
- Operations: `add`, `remove`, `list`.
- Cleans `file://` prefix from input paths (common agent mistake).

### Tool: `debug_info`

- Returns workspace root, all search paths, path existence/readability, scan warnings.

## Key Design Decisions

- **Dynamic prompts via low-level handlers**: `McpServer.registerPrompt()` is static (throws on duplicate) and sends `listChanged` on every registration. For dynamic FS-backed skills, using `server.server.setRequestHandler()` is cleaner.
- **Recursive Scanning**: Subdirectories allowed for categorized folder structures (e.g., `dax/skills/writing-dax-measures`).
- **No Database**: Lightweight and stateless — scan the FS. Performance acceptable for <1000 skills.
- **chokidar over fs.watch**: `fs.watch` is unreliable on Windows. chokidar is the de-facto standard.
- **Version from package.json**: Server version read at runtime via `createRequire` — single source of truth.

## Development Guidelines

- **Building**: `npm run build` runs `tsc`.
- **Testing**: `npm test` runs vitest. Tests use `vi.mock('fs')` for FS operations.
- **Adding Tools**: Use `server.tool(name, description, schema, annotations, handler)` in `src/index.ts`.
- **Error Handling**: All FS operations wrapped in try/catch. Scan errors become `ScanWarning` objects, never crashes.
- **Prompts**: Do not use `server.registerPrompt()` — it conflicts with the low-level handlers already registered.
