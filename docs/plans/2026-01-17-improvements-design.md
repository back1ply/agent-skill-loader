# Agent Skill Loader Improvements Design

**Date**: 2026-01-17
**Status**: Approved

## Overview

Improvements to developer experience and robustness without adding complexity.

## Scope

| Area | In Scope | Out of Scope |
|------|----------|--------------|
| Performance | - | Caching |
| Dev Experience | Better discovery errors, `debug_info` tool | Skill authoring/validation |
| Features | - | Versioning, deps, tags, search |
| Robustness | More tests, error recovery | YAML parsing |

## 1. Error Recovery

### Problem
If one skill directory is corrupted or inaccessible, errors are silently swallowed. No visibility into what went wrong.

### Solution
Collect warnings during scan instead of ignoring them. Surface via `debug_info` tool (not `list_skills` to avoid bloating normal responses).

### Types

```typescript
export interface ScanResult {
  skills: SkillInfo[];
  warnings: ScanWarning[];
}

export interface ScanWarning {
  path: string;
  reason: string;
}
```

### Recovery Points
1. Directory doesn't exist - warn, skip, continue
2. Permission denied - warn, skip, continue
3. SKILL.md unreadable - warn, skip skill, continue scanning
4. SKILL.md empty/malformed - warn, skip, continue
5. Unexpected error - catch, warn, continue (never crash)

## 2. Debug Info Tool

### Problem
When skills aren't found, users can't see what paths are scanned or why.

### Solution
New `debug_info` tool exposing server internals.

```typescript
server.tool(
  "debug_info",
  "Returns diagnostic information about server configuration and state",
  {},
  async () => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          workspace_root: getWorkspaceRoot(),
          search_paths: {
            base: getBasePaths(),
            dynamic: getDynamicPathsOnly(),
            effective: getDynamicPaths()
          },
          path_status: getPathStatus(),
          env: {
            MCP_SKILL_PATHS: process.env.MCP_SKILL_PATHS || null,
            MCP_WORKSPACE_ROOT: process.env.MCP_WORKSPACE_ROOT || null
          },
          skills_found: getAllSkills().length,
          warnings: getAllWarnings()
        }, null, 2)
      }]
    };
  }
);
```

### Path Status Format
```json
[
  { "path": "C:/Users/pc/.claude/plugins/cache", "exists": true, "readable": true },
  { "path": "F:/My/Skills", "exists": false, "readable": false }
]
```

## 3. Test Coverage

### utils.test.ts (add)

Error recovery:
- `findSkillsInDir`: returns empty for non-existent path
- `findSkillsInDir`: skips unreadable directories, continues
- `findSkillsInDir`: handles empty SKILL.md
- `findSkillsInDir`: skips DO_NOT_SCAN directories

Edge cases:
- `extractDescription`: handles missing description
- `extractDescription`: handles empty string

### index.test.ts (new)

list_skills:
- returns skills array when skills exist
- returns error info when no skills found

read_skill:
- returns content for valid skill
- returns isError for non-existent skill

install_skill:
- rejects paths outside workspace
- handles non-existent skill

manage_search_paths:
- add: adds new path
- remove: removes path
- list: returns all categories

debug_info:
- returns expected structure
- reports non-existent paths

## File Changes

1. `src/utils.ts` - Add types, modify `findSkillsInDir`, add `getPathStatus`
2. `src/index.ts` - Add `debug_info` tool, update internals
3. `src/utils.test.ts` - Add error recovery tests
4. `src/index.test.ts` - New file for MCP tool tests
