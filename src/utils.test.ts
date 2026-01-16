import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extractDescription, findSkillsInDir, getPathStatus, SkillInfo } from './utils.js';

vi.mock('fs');

describe('findSkillsInDir', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

  it('finds skills in directory', () => {
    const mockReaddirSync = vi.mocked(fs.readdirSync);
    const mockReadFileSync = vi.mocked(fs.readFileSync);
    const mockExistsSync = vi.mocked(fs.existsSync);

    mockExistsSync.mockReturnValue(true);

    // Mock structure:
    // /root
    //   /skill1 (has SKILL.md)
    //   /subdir
    //     /skill2 (has SKILL.md)

    mockReaddirSync.mockImplementation((dirPath) => {
        const p = dirPath.toString();
        if (p.endsWith('root')) {
            return [
                { name: 'skill1', isFile: () => false, isDirectory: () => true } as any,
                { name: 'subdir', isFile: () => false, isDirectory: () => true } as any,
            ];
        }
        if (p.endsWith('skill1')) {
             return [{ name: 'SKILL.md', isFile: () => true, isDirectory: () => false } as any];
        }
        if (p.endsWith('subdir')) {
            return [{ name: 'skill2', isFile: () => false, isDirectory: () => true } as any];
        }
        if (p.endsWith('skill2')) {
             return [{ name: 'SKILL.md', isFile: () => true, isDirectory: () => false } as any];
        }
        return [];
    });

    mockReadFileSync.mockReturnValue('description: Test Description');

    const result = findSkillsInDir('/root');
    expect(result.skills).toHaveLength(2);
    expect(result.skills.map((s: SkillInfo) => s.name)).toContain('skill1');
    expect(result.skills.map((s: SkillInfo) => s.name)).toContain('skill2');
    expect(result.warnings).toHaveLength(0);
  });

  it('returns empty result with warning for non-existent path', () => {
    const mockExistsSync = vi.mocked(fs.existsSync);
    mockExistsSync.mockReturnValue(false);

    const result = findSkillsInDir('/non-existent');
    expect(result.skills).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toBe('Directory does not exist');
  });

  it('skips unreadable directories and continues scanning', () => {
    const mockReaddirSync = vi.mocked(fs.readdirSync);
    const mockReadFileSync = vi.mocked(fs.readFileSync);
    const mockExistsSync = vi.mocked(fs.existsSync);

    mockExistsSync.mockReturnValue(true);

    // Mock structure:
    // /root
    //   /locked (permission denied)
    //   /skill1 (has SKILL.md)

    mockReaddirSync.mockImplementation((dirPath) => {
        const p = dirPath.toString();
        if (p.endsWith('root')) {
            return [
                { name: 'locked', isFile: () => false, isDirectory: () => true } as any,
                { name: 'skill1', isFile: () => false, isDirectory: () => true } as any,
            ];
        }
        if (p.endsWith('locked')) {
            const err = new Error('Permission denied') as any;
            err.code = 'EACCES';
            throw err;
        }
        if (p.endsWith('skill1')) {
            return [{ name: 'SKILL.md', isFile: () => true, isDirectory: () => false } as any];
        }
        return [];
    });

    mockReadFileSync.mockReturnValue('description: Test Description');

    const result = findSkillsInDir('/root');
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe('skill1');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toContain('EACCES');
  });

  it('handles empty SKILL.md with warning', () => {
    const mockReaddirSync = vi.mocked(fs.readdirSync);
    const mockReadFileSync = vi.mocked(fs.readFileSync);
    const mockExistsSync = vi.mocked(fs.existsSync);

    mockExistsSync.mockReturnValue(true);

    mockReaddirSync.mockImplementation((dirPath) => {
        const p = dirPath.toString();
        if (p.endsWith('root')) {
            return [{ name: 'empty-skill', isFile: () => false, isDirectory: () => true } as any];
        }
        if (p.endsWith('empty-skill')) {
            return [{ name: 'SKILL.md', isFile: () => true, isDirectory: () => false } as any];
        }
        return [];
    });

    mockReadFileSync.mockReturnValue('');

    const result = findSkillsInDir('/root');
    expect(result.skills).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toBe('SKILL.md is empty');
  });

  it('skips DO_NOT_SCAN directories', () => {
    const mockReaddirSync = vi.mocked(fs.readdirSync);
    const mockReadFileSync = vi.mocked(fs.readFileSync);
    const mockExistsSync = vi.mocked(fs.existsSync);

    mockExistsSync.mockReturnValue(true);

    // Mock structure with node_modules that should be skipped
    mockReaddirSync.mockImplementation((dirPath) => {
        const p = dirPath.toString();
        if (p.endsWith('root')) {
            return [
                { name: 'node_modules', isFile: () => false, isDirectory: () => true } as any,
                { name: '.git', isFile: () => false, isDirectory: () => true } as any,
                { name: 'skill1', isFile: () => false, isDirectory: () => true } as any,
            ];
        }
        if (p.endsWith('skill1')) {
            return [{ name: 'SKILL.md', isFile: () => true, isDirectory: () => false } as any];
        }
        // These should never be called
        if (p.includes('node_modules') || p.includes('.git')) {
            throw new Error('Should not scan this directory');
        }
        return [];
    });

    mockReadFileSync.mockReturnValue('description: Test Description');

    const result = findSkillsInDir('/root');
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe('skill1');
  });
});


describe('extractDescription', () => {
  it('extracts description from SKILL.md frontmatter', () => {
    const content = `---
name: test-skill
description: This is a test skill
---

# Test Skill
`;
    expect(extractDescription(content)).toBe('This is a test skill');
  });

  it('returns default message when no description found', () => {
    const content = `---
name: test-skill
---
`;
    expect(extractDescription(content)).toBe('No description provided.');
  });

  it('handles empty string input', () => {
    expect(extractDescription('')).toBe('No description provided.');
  });
});

describe('getPathStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns correct status for existing readable path', () => {
    const mockExistsSync = vi.mocked(fs.existsSync);
    const mockAccessSync = vi.mocked(fs.accessSync);

    mockExistsSync.mockReturnValue(true);
    mockAccessSync.mockImplementation(() => {}); // No throw = readable

    const result = getPathStatus(['/readable/path']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: '/readable/path',
      exists: true,
      readable: true
    });
  });

  it('returns correct status for non-existent path', () => {
    const mockExistsSync = vi.mocked(fs.existsSync);

    mockExistsSync.mockReturnValue(false);

    const result = getPathStatus(['/non-existent']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: '/non-existent',
      exists: false,
      readable: false
    });
  });

  it('returns correct status for existing but unreadable path', () => {
    const mockExistsSync = vi.mocked(fs.existsSync);
    const mockAccessSync = vi.mocked(fs.accessSync);

    mockExistsSync.mockReturnValue(true);
    mockAccessSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = getPathStatus(['/locked/path']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: '/locked/path',
      exists: true,
      readable: false
    });
  });
});
