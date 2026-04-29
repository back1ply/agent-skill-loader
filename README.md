# Agent Skill Loader 🧠

[![npm version](https://img.shields.io/npm/v/agent-skill-loader)](https://www.npmjs.com/package/agent-skill-loader)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)

**Agent Skill Loader** is a Model Context Protocol (MCP) server that acts as a bridge between your static Claude Code Skills library and dynamic AI agents (like Claude Desktop, Cursor, or any MCP client).

It exposes skills both as **MCP Prompts** (slash commands, zero tool calls needed) and as **MCP Tools** (for programmatic use). Skills are auto-discovered from configured directories and stay live — add a new `SKILL.md` and the client is notified automatically.

## 🚀 Features

- **MCP Prompts**: Skills appear as slash commands in clients. No tool call needed to inject them.
- **Live updates**: `listChanged` notification fires when skills are added or removed (via file watcher).
- **Discovery**: `list_skills` — scans configured skill directories, with optional search filter.
- **Dynamic Learning**: `read_skill` — fetches the `SKILL.md` content.
- **Persistence**: `install_skill` — copies a skill permanently to your project.
- **Configuration**: `manage_search_paths` — add/remove skill directories at runtime.
- **Troubleshooting**: `debug_info` — diagnose configuration and path issues.

## 🛠️ Setup

### Prerequisites
- Node.js >= 18

### Option A: Install from npm (Recommended)
```bash
npm install -g agent-skill-loader
```

Then register in `.mcp.json`:
```json
"agent-skill-loader": {
  "command": "agent-skill-loader"
}
```

### Option B: Build from Source
```bash
git clone https://github.com/back1ply/agent-skill-loader.git
cd agent-skill-loader
npm install
npm run build
```

Then register in `.mcp.json`:
```json
"agent-skill-loader": {
  "command": "node",
  "args": ["<path-to-repo>/build/index.js"]
}
```

## 📂 Configuration

The server automatically detects its workspace and aggregates skill paths from:

1. **Default**: `%USERPROFILE%\.claude\plugins\cache` (Standard location)
2. **Dynamic Config**: `skill-paths.json` (Located in the project root)

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MCP_SKILL_PATHS` | JSON array or semicolon/comma-separated list of additional skill paths |
| `MCP_WORKSPACE_ROOT` | Override auto-detected workspace root |
| `MCP_NO_WATCH` | Set to `1` to disable the file watcher (useful in CI) |

### Dynamic Path Management
You do not need to manually edit config files. Use the tool to manage paths at runtime:
- **Add**: `manage_search_paths(operation="add", path="F:\\My\\Deep\\Skills")`
- **Remove**: `manage_search_paths(operation="remove", path="...")`
- **List**: `manage_search_paths(operation="list")` creates/updates `skill-paths.json`.

## 🤖 Usage

### MCP Prompts (Slash Commands)

If your client supports MCP Prompts (Claude Desktop, Cursor, etc.), skills appear automatically as slash commands. Select a skill from the slash command menu to inject its content directly — no tool calls needed.

### Tools

The agent has access to five tools:

- `list_skills(query?)`: Returns a JSON list of available skills. Optional `query` filters by name/description substring (case-insensitive).
- `read_skill(skill_name)`: Returns the markdown instructions for a skill.
- `install_skill(skill_name, target_path?)`: Copies the skill folder to `.agent/skills/<name>`. For security, `target_path` must be within the current workspace.
- `manage_search_paths(operation, path?)`: Add, remove, or list skill search paths.
- `debug_info()`: Returns diagnostic information (paths, status, warnings).

### Example Agent Prompt
> "I need to write a DAX measure but I'm not sure about the best practices."

The agent will automatically call `list_skills`, find `writing-dax-measures`, call `read_skill`, and answer with expert knowledge. Or the user can invoke the skill directly as a slash command.

## 🔧 Troubleshooting

If skills aren't being discovered, use `debug_info()` to see:
- **search_paths**: Which directories are being scanned
- **path_status**: Whether each path exists and is readable
- **warnings**: Any errors encountered during scanning (permission denied, empty files, etc.)

Example output:
```json
{
  "workspace_root": "C:/projects/agent-skill-loader",
  "search_paths": {
    "base": ["C:/Users/pc/.claude/plugins/cache"],
    "dynamic": ["F:/My/Skills"],
    "effective": ["C:/Users/pc/.claude/plugins/cache", "F:/My/Skills"]
  },
  "path_status": [
    { "path": "C:/Users/pc/.claude/plugins/cache", "exists": true, "readable": true },
    { "path": "F:/My/Skills", "exists": false, "readable": false }
  ],
  "skills_found": 12,
  "warnings": [
    { "path": "F:/My/Skills", "reason": "Directory does not exist" }
  ]
}
```

## 📦 Project Structure

- `src/index.ts`: Main server logic (tools + prompts + watcher).
- `src/utils.ts`: Skill scanning, description extraction, prompt helpers, debounce.
- `build/`: Compiled JavaScript output.
- `package.json`: Dependencies (`@modelcontextprotocol/sdk`, `chokidar`, `zod`).

## 🤝 Contributing

To add new skills, add a folder with a `SKILL.md` file to one of the watched directories. The server picks them up automatically and sends a `listChanged` notification — no restart required.
