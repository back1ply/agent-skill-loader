import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extractDescription, findSkillsInDir } from './utils';

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

    const skills = findSkillsInDir('/root');
    expect(skills).toHaveLength(2);
    expect(skills.map(s => s.name)).toContain('skill1');
    expect(skills.map(s => s.name)).toContain('skill2');
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
});
