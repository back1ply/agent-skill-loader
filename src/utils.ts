import * as fs from "fs";
import * as path from "path";

// --- Configuration ---
export const DO_NOT_SCAN = ["node_modules", ".git", "dist", "build"];

// --- Types ---
export interface SkillInfo {
  name: string;
  description: string;
  path: string; // Directory containing SKILL.md
  source: string;
}

export function extractDescription(content: string): string {
  const match = content.match(/^description:\s*(.+)$/m);
  return match ? match[1].trim() : "No description provided.";
}

export function findSkillsInDir(startPath: string): SkillInfo[] {
  const skills: SkillInfo[] = [];

  if (!fs.existsSync(startPath)) return [];

  function scan(currentPath: string) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (e) {
      // Ignore access errors or other FS issues
      return;
    }

    // Check if this directory is a skill (has SKILL.md)
    const skillFile = entries.find((e) => e.isFile() && e.name === "SKILL.md");
    if (skillFile) {
      const fullPath = path.join(currentPath, skillFile.name);
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        skills.push({
          name: path.basename(currentPath),
          description: extractDescription(content),
          path: currentPath,
          source: startPath,
        });
      } catch (err) {
        // Ignore read errors
      }
      // If we found a skill, we assume subdirectories are part of the skill
      return;
    }

    // Otherwise, recurse
    for (const entry of entries) {
      if (entry.isDirectory() && !DO_NOT_SCAN.includes(entry.name)) {
        scan(path.join(currentPath, entry.name));
      }
    }
  }

  scan(startPath);
  return skills;
}
