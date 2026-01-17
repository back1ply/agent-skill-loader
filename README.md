# Agent Skill Loader 🧠

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)

**Agent Skill Loader** is a Model Context Protocol (MCP) server that acts as a bridge between your static Claude Code Skills library and dynamic AI agents (like Antigravity, Claude Desktop, or Cursor).

It allows agents to "learn" skills on demand without requiring you to manually copy files into every project.

## 🚀 Features

*   **Discovery**: `list_skills` - Scans your configured skill directories.
*   **Dynamic Learning**: `read_skill` - Fetches the `SKILL.md` content for the agent to read.
*   **Persistence**: `install_skill` - Copies the skill permanently to your project if needed.
*   **Configuration**: `manage_search_paths` - Add/remove skill directories at runtime.
*   **Troubleshooting**: `debug_info` - Diagnose configuration and path issues.

## 🛠️ Setup

### Prerequisites
- Node.js >= 18

### 1. Build the Server
```bash
npm install
npm run build
```

### 2. Register in `.mcp.json`
Add the minimal configuration to your global `C:\Users\pc\.mcp.json` (or project-specific config):

```json
"agent-skill-loader": {
  "command": "node",
  "args": [
    "<path-to-this-repo>/build/index.js"
  ]
}
```

## 📂 Configuration

The server automatically detects its workspace and aggregates skill paths from:

1.  **Default**: `%USERPROFILE%\.claude\plugins\cache` (Standard location)
2.  **Dynamic Config**: `skill-paths.json` (Located in the project root)

### Dynamic Path Management
You do not need to manually edit config files. Use the tool to manage paths at runtime:
*   **Add**: `manage_search_paths(operation="add", path="F:\\My\\Deep\\Skills")`
*   **Remove**: `manage_search_paths(operation="remove", path="...")`
*   **List**: `manage_search_paths(operation="list")` creates/updates `skill-paths.json`.

## 🤖 Usage

### For Agents
The agent will see five tools:
*   `list_skills()`: Returns a JSON list of available skills.
*   `read_skill(skill_name)`: Returns the markdown instructions.
*   `install_skill(skill_name, target_path?)`: Copies the folder to `.agent/skills/<name>`. For security, `target_path` must be within the current workspace.
*   `manage_search_paths(operation, path?)`: Add, remove, or list skill search paths.
*   `debug_info()`: Returns diagnostic information (paths, status, warnings).

### Example Agent Prompt
> "I need to write a DAX measure but I'm not sure about the best practices."

The agent will automatically call `list_skills`, find `writing-dax-measures`, call `read_skill`, and then answer you with expert knowledge.

## 🔧 Troubleshooting

If skills aren't being discovered, use `debug_info()` to see:
*   **search_paths**: Which directories are being scanned
*   **path_status**: Whether each path exists and is readable
*   **warnings**: Any errors encountered during scanning (permission denied, empty files, etc.)

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

*   `src/index.ts`: Main server logic.
*   `build/`: Compiled JavaScript output.
*   `package.json`: Dependencies (`@modelcontextprotocol/sdk`, `zod`).

## 🤝 Contributing

To add new skills, simply add a folder with a `SKILL.md` file to one of the watched directories. The server picks them up automatically (no restart required for new files, though caching implementation may vary).
