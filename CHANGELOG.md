# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [SemVer](https://semver.org/).
Releases before 1.2.1 are in the [git history](https://github.com/back1ply/agent-skill-loader/commits/main).

## [1.2.1] - 2026-10-15

### Fixed
- `install_skill`: `target_path` check accepted sibling folders sharing the workspace prefix (e.g. `proj-x` for `proj`). Now uses `path.relative`.
- `manage_search_paths` was annotated `readOnlyHint: true` although `add`/`remove` write `skill-paths.json`. Now `readOnlyHint: false, destructiveHint: true`.
- `list_skills` with no skills found returned a success result containing env vars and cwd. It now returns `isError` with a pointer to `debug_info`; a query with no matches returns a normal result.

### Changed
- `@modelcontextprotocol/sdk` ^1.32.1; dependencies updated, `npm audit` clean.

### Added
- `npm run probe`: lists tools via the MCP Inspector CLI.
- CI on Ubuntu and Windows.

[1.2.1]: https://github.com/back1ply/agent-skill-loader/compare/v1.2.0...v1.2.1
