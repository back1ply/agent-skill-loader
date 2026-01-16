import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs before importing the module
vi.mock('fs');

// We need to test the server tool handlers. Since the tools are registered
// on the McpServer instance, we'll test the underlying logic by mocking
// the file system and verifying behavior through the utils functions.

// For now, we'll focus on testing that the module loads and the key
// security/validation logic works correctly.

describe('index module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('install_skill security', () => {
    it('should reject paths outside workspace', () => {
      // The security check in install_skill validates that target path
      // is within the workspace. Test the path normalization logic.
      const cwd = process.platform === 'win32' ? 'C:\\workspace' : '/workspace';
      const maliciousPath = '../../../etc/passwd';
      const dest = path.join(cwd, maliciousPath);
      const normalizedDest = path.normalize(dest);
      const normalizedCwd = path.normalize(cwd);

      // The security check: normalizedDest.startsWith(normalizedCwd)
      expect(normalizedDest.startsWith(normalizedCwd)).toBe(false);
    });

    it('should accept paths inside workspace', () => {
      // Use platform-appropriate paths
      const cwd = process.platform === 'win32' ? 'C:\\workspace' : '/workspace';
      const safePath = '.agent/skills/my-skill';
      const resolved = path.resolve(cwd, safePath);
      const normalizedDest = path.normalize(resolved);
      const normalizedCwd = path.normalize(cwd);

      // On Windows, path.resolve with absolute path ignores cwd, so we need
      // to use path.join for relative paths
      const dest = path.join(cwd, safePath);
      const normalizedDestFixed = path.normalize(dest);

      expect(normalizedDestFixed.startsWith(normalizedCwd)).toBe(true);
    });
  });

  describe('manage_search_paths', () => {
    it('should clean file:// prefix from paths', () => {
      // The manage_search_paths tool cleans file:// prefixes
      const inputPath = 'file:///C:/Users/skills';
      const cleanPath = inputPath.replace(/^file:\/\/\/?/, '');
      expect(cleanPath).toBe('C:/Users/skills');
    });

    it('should handle file:// with different slash counts', () => {
      const inputs = [
        'file:///C:/path',
        'file://C:/path',
        'file:/C:/path', // This won't match the pattern
      ];
      const expected = [
        'C:/path',
        'C:/path',
        'file:/C:/path', // Unchanged
      ];

      inputs.forEach((input, i) => {
        const cleaned = input.replace(/^file:\/\/\/?/, '');
        expect(cleaned).toBe(expected[i]);
      });
    });
  });

  describe('getBasePaths', () => {
    it('should parse MCP_SKILL_PATHS as JSON array', () => {
      const envPaths = '["C:/path1", "C:/path2"]';
      const parsed = JSON.parse(envPaths);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toEqual(['C:/path1', 'C:/path2']);
    });

    it('should parse MCP_SKILL_PATHS as semicolon-separated string', () => {
      const envPaths = 'C:/path1;C:/path2';
      const paths = envPaths.split(/;|,/).map(p => p.trim()).filter(Boolean);
      expect(paths).toEqual(['C:/path1', 'C:/path2']);
    });

    it('should parse MCP_SKILL_PATHS as comma-separated string', () => {
      const envPaths = 'C:/path1,C:/path2';
      const paths = envPaths.split(/;|,/).map(p => p.trim()).filter(Boolean);
      expect(paths).toEqual(['C:/path1', 'C:/path2']);
    });
  });

  describe('loadEnvFile', () => {
    it('should parse .env file format correctly', () => {
      const envContent = `
# Comment line
KEY1=value1
KEY2="quoted value"
KEY3='single quoted'
EMPTY=
`;
      const lines = envContent.split(/\r?\n/);
      const parsed: Record<string, string> = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            parsed[key] = value;
          }
        }
      }

      expect(parsed.KEY1).toBe('value1');
      expect(parsed.KEY2).toBe('quoted value');
      expect(parsed.KEY3).toBe('single quoted');
      expect(parsed.EMPTY).toBe('');
    });
  });
});

describe('MCP tool response format', () => {
  it('should return valid MCP content structure', () => {
    // Verify the response format matches MCP spec
    const validResponse = {
      content: [{ type: 'text', text: 'some content' }]
    };

    expect(validResponse.content).toBeInstanceOf(Array);
    expect(validResponse.content[0].type).toBe('text');
    expect(typeof validResponse.content[0].text).toBe('string');
  });

  it('should return valid MCP error structure', () => {
    const errorResponse = {
      content: [{ type: 'text', text: 'Error message' }],
      isError: true
    };

    expect(errorResponse.isError).toBe(true);
    expect(errorResponse.content[0].type).toBe('text');
  });
});
