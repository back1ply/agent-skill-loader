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

export interface ScanWarning {
  path: string;
  reason: string;
}

export interface ScanResult {
  skills: SkillInfo[];
  warnings: ScanWarning[];
}

export interface PathStatus {
  path: string;
  exists: boolean;
  readable: boolean;
}

export function extractDescription(content: string): string {
  const match = content.match(/^description:\s*(.+)$/m);
  return match ? match[1].trim() : "No description provided.";
}

export function findSkillsInDir(startPath: string): ScanResult {
  const skills: SkillInfo[] = [];
  const warnings: ScanWarning[] = [];

  if (!fs.existsSync(startPath)) {
    warnings.push({ path: startPath, reason: "Directory does not exist" });
    return { skills, warnings };
  }

  function scan(currentPath: string) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (e: any) {
      warnings.push({
        path: currentPath,
        reason: `Cannot read directory: ${e.code || e.message}`
      });
      return;
    }

    // Check if this directory is a skill (has SKILL.md)
    const skillFile = entries.find((e) => e.isFile() && e.name === "SKILL.md");
    if (skillFile) {
      const fullPath = path.join(currentPath, skillFile.name);
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (!content.trim()) {
          warnings.push({ path: fullPath, reason: "SKILL.md is empty" });
          return;
        }
        skills.push({
          name: path.basename(currentPath),
          description: extractDescription(content),
          path: currentPath,
          source: startPath,
        });
      } catch (err: any) {
        warnings.push({
          path: fullPath,
          reason: `Cannot read SKILL.md: ${err.code || err.message}`
        });
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
  return { skills, warnings };
}

export function getPathStatus(paths: string[]): PathStatus[] {
  return paths.map((p) => {
    const exists = fs.existsSync(p);
    let readable = false;
    if (exists) {
      try {
        fs.accessSync(p, fs.constants.R_OK);
        readable = true;
      } catch {
        readable = false;
      }
    }
    return { path: p, exists, readable };
  });
}
