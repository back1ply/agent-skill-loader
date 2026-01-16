# Architecture & Context 🏗️

This document provides technical context for AI agents working on this codebase.

## System Overview

**Agent Skill Loader** is a Node.js-based MCP Server. It does not maintain a persistent database; it scans the file system in real-time (or near real-time) to discover "Skills".

### Core Definitions

*   **Skill**: A directory containing a `SKILL.md` file. The `SKILL.md` contains the instructions (system prompt fragment) for the AI.
*   **Skill Library**: A root directory containing multiple Skill directories.

## Logic Flow (`src/index.ts`)

1.  **Initialization**:
    *   The server starts using `StdioServerTransport`.
    *   It loads configuration from `.env`.
    *   It reads `MCP_SKILL_PATHS` to determine where to scan.

2.  **Tool: `list_skills`**:
    *   Recursively scans `SEARCH_PATHS`.
    *   Looks for `SKILL.md`.
    *   Parses frontmatter (YAML-style) to extract `description`.
    *   Returns a simplified JSON list to save context tokens.

3.  **Tool: `read_skill`**:
    *   Finds the specific skill by name.
    *   Reads `SKILL.md`.
    *   Returns the raw text Content.

4.  **Tool: `install_skill`**:
    *   Locates the source directory.
    *   **Security**: Validates that target path is within current workspace.
    *   Uses `fs.cpSync` to recursively copy the content to the User's active workspace.

## Key Design Decisions

*   **Recursive Scanning**: We scan subdirectories to find skills, allowing for categorized folder structures (e.g., `dax/skills/writing-dax-measures`).
*   **No Database**: To keep it lightweight and stateless, we scan the FS. Performance is acceptable for <1000 skills.
*   **TypeScript**: Used for type safety with the MCP SDK.

## Development Guidelines

*   **Building**: `npm run build` runs `tsc`.
*   **Modifying Tools**: Add new tools in `src/index.ts` using `server.tool()`.
*   **Error Handling**: All filesystem operations should be wrapped in try/catch blocks to prevent server crashes.
