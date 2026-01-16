import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { extractDescription, findSkillsInDir, getPathStatus, SkillInfo, ScanWarning, ScanResult } from "./utils.js";

// Load environment variables manually (dotenv v17 outputs to stdout which corrupts MCP)
function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIndex = trimmed.indexOf("=");
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();
            // Remove surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
    }
  } catch {
    // Silently ignore .env loading errors
  }
}
loadEnvFile();

// --- Configuration ---


import * as os from "os";
import { fileURLToPath } from 'url';

// --- Workspace & Config Logic ---

// Auto-detect workspace root (project root)
// We are in /build/index.js, so project root is one level up
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTO_DETECTED_ROOT = path.resolve(__dirname, "..");

function getWorkspaceRoot(): string {
  // Allow override, else use auto-detected
  return process.env.MCP_WORKSPACE_ROOT || AUTO_DETECTED_ROOT;
}

function getBasePaths(): string[] {
  // 1. Always start with default path
  const defaultPath = path.join(os.homedir(), ".claude", "plugins", "cache");
  const paths = [defaultPath];

  // 2. Add process.env paths if present
  let envPaths = process.env.MCP_SKILL_PATHS;
  if (envPaths) {
    try {
      const parsed = JSON.parse(envPaths);
      if (Array.isArray(parsed)) {
        paths.push(...parsed);
      } else {
         // Assume separated string
         paths.push(...envPaths.split(/;|,/).map((p) => p.trim()).filter(Boolean));
      }
    } catch {
       // Not valid JSON, assume separated string
       paths.push(...envPaths.split(/;|,/).map((p) => p.trim()).filter(Boolean));
    }
  }

  // Deduplicate
  return Array.from(new Set(paths));
}

function getDynamicPaths(): string[] {
  const basePaths = getBasePaths();
  const cwd = getWorkspaceRoot();
  const configPath = path.join(cwd, "skill-paths.json");

  let dynamicPaths: string[] = [];
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        dynamicPaths = parsed;
      }
    } catch (err) {
      console.error("Error reading skill-paths.json:", err);
    }
  }

  // Deduplicate
  return Array.from(new Set([...basePaths, ...dynamicPaths]));
}

// --- Types ---


// --- Helpers ---

function getDynamicPathsOnly(): string[] {
  const cwd = getWorkspaceRoot();
  const configPath = path.join(cwd, "skill-paths.json");

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Ignore errors
    }
  }
  return [];
}

function scanAllPaths(): ScanResult {
  let allSkills: SkillInfo[] = [];
  let allWarnings: ScanWarning[] = [];
  const searchPaths = getDynamicPaths();

  for (const searchPath of searchPaths) {
    const result = findSkillsInDir(searchPath);
    allSkills = allSkills.concat(result.skills);
    allWarnings = allWarnings.concat(result.warnings);
  }

  return { skills: allSkills, warnings: allWarnings };
}

function getAllSkills(): SkillInfo[] {
  return scanAllPaths().skills;
}

function getAllWarnings(): ScanWarning[] {
  return scanAllPaths().warnings;
}

// --- Server Setup ---
const server = new McpServer({
  name: "agent-skill-loader",
  version: "1.0.0",
});

// --- Tools ---

// 1. list_skills - Lists all available skills from configured directories
server.tool(
  "list_skills",
  "Returns a JSON list of all available skills with their names, descriptions, and source directories. Use this to discover what skills are available before reading or installing them.",
  {},
  async () => {
    const skills = getAllSkills();
    // Debug: include examined paths if no skills found OR always for now
    if (skills.length === 0) {
       return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
               error: "No skills found",
               env_var: process.env.MCP_SKILL_PATHS,
               parsed_paths: getDynamicPaths(),
               cwd: process.cwd()
            }, null, 2)
          }
        ]
       }
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            skills.map((s) => ({
              name: s.name,
              description: s.description,
              source_root: s.source,
            })),
            null,
            2,
          ),
        },
      ],
    };
  },
);

// 2. read_skill - Fetches the full SKILL.md content for a skill
server.tool(
  "read_skill",
  "Fetches and returns the full SKILL.md content for a specific skill. The content includes instructions and context that can be used to learn the skill's capabilities.",
  {
    skill_name: z
      .string()
      .describe("The name of the skill to read (e.g., 'writing-dax-measures')"),
  },
  async ({ skill_name }) => {
    const skills = getAllSkills();
    const skill = skills.find((s) => s.name === skill_name);

    if (!skill) {
      return {
        content: [{ type: "text", text: `Skill '${skill_name}' not found.` }],
        isError: true,
      };
    }

    const skillMdPath = path.join(skill.path, "SKILL.md");

    try {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      return {
        content: [{ type: "text", text: content }],
      };
    } catch (err: any) {
      return {
        content: [
          { type: "text", text: `Failed to read skill: ${err.message}` },
        ],
        isError: true,
      };
    }
  },
);

// 3. install_skill - Copies a skill to the target workspace
server.tool(
  "install_skill",
  "Copies an entire skill directory (including SKILL.md and any supporting files) to the target workspace. By default, installs to .agent/skills/<skill_name> in the current working directory.",
  {
    skill_name: z.string().describe("Name of the skill to install"),
    target_path: z
      .string()
      .optional()
      .describe(
        "Destination path within current workspace. Defaults to .agent/skills/<skill_name>. Must be within the current working directory for security.",
      ),
  },
  async ({ skill_name, target_path }) => {
    const skills = getAllSkills();
    const skill = skills.find((s) => s.name === skill_name);

    if (!skill) {
      return {
        content: [{ type: "text", text: `Skill '${skill_name}' not found.` }],
        isError: true,
      };
    }

    // Default target: .agent/skills/name
    const cwd = getWorkspaceRoot();
    let dest: string;

    if (target_path) {
      dest = path.resolve(cwd, target_path);
      // Security: Ensure target path is within current working directory
      const normalizedDest = path.normalize(dest);
      const normalizedCwd = path.normalize(cwd);
      if (!normalizedDest.startsWith(normalizedCwd)) {
        return {
          content: [
            {
              type: "text",
              text: `Security error: Target path must be within the current workspace (${cwd}). Received: ${dest}`,
            },
          ],
          isError: true,
        };
      }
    } else {
      dest = path.join(cwd, ".agent", "skills", skill.name);
    }

    try {
      fs.cpSync(skill.path, dest, { recursive: true, force: true });
      return {
        content: [
          {
            type: "text",
            text: `Successfully installed skill '${skill_name}' to '${dest}'`,
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          { type: "text", text: `Failed to install skill: ${err.message}` },
        ],
        isError: true,
      };
    }
  },
);

// 4. manage_search_paths - Runtime management of skill paths
server.tool(
  "manage_search_paths",
  "Add, remove, or list dynamic skill search paths without restarting the server. Persists to skill-paths.json in the workspace root.",
  {
    operation: z.enum(["add", "remove", "list"]).describe("Operation to perform"),
    path: z.string().optional().describe("Absolute path to add or remove (not required for 'list')"),
  },
  async ({ operation, path: inputPath }) => {
    const cwd = getWorkspaceRoot();
    const configPath = path.join(cwd, "skill-paths.json");
    
    // Read current config
    let currentPaths: string[] = [];
    if (fs.existsSync(configPath)) {
      try {
        currentPaths = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (!Array.isArray(currentPaths)) currentPaths = [];
      } catch {
        currentPaths = [];
      }
    }

    if (operation === "list") {
      const globalPaths = getBasePaths();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            dynamic: currentPaths,
            global: globalPaths,
            effective: Array.from(new Set([...globalPaths, ...currentPaths]))
          }, null, 2)
        }]
      };
    }

    if (!inputPath) {
      return {
        content: [{ type: "text", text: "Path argument is required for add/remove operations." }],
        isError: true
      };
    }

    // Normalize input path
    // Remove "file:///" prefix if present (common agent error)
    const cleanPath = inputPath.replace(/^file:\/\/\/?/, "");
    // On Windows, if it looks like /c:/..., make it c:/...
    // But path.resolve usually handles normal paths well.
    const absPath = path.resolve(cleanPath);

    if (operation === "add") {
      if (!currentPaths.includes(absPath)) {
        currentPaths.push(absPath);
        fs.writeFileSync(configPath, JSON.stringify(currentPaths, null, 2));
        return {
          content: [{ type: "text", text: `Added path: ${absPath}` }]
        };
      }
      return {
        content: [{ type: "text", text: `Path already exists: ${absPath}` }]
      };
    }

    if (operation === "remove") {
      const initialLen = currentPaths.length;
      currentPaths = currentPaths.filter(p => p !== absPath);
      if (currentPaths.length !== initialLen) {
        fs.writeFileSync(configPath, JSON.stringify(currentPaths, null, 2));
        return {
          content: [{ type: "text", text: `Removed path: ${absPath}` }]
        };
      }
      return {
        content: [{ type: "text", text: `Path not found in config: ${absPath}` }]
      };
    }

    return { content: [{ type: "text", text: "Invalid operation" }], isError: true };
  }
);

// 5. debug_info - Diagnostic information for troubleshooting
server.tool(
  "debug_info",
  "Returns diagnostic information about server configuration, search paths, and any warnings from the last scan. Use this when skills aren't being found or to verify configuration.",
  {},
  async () => {
    const effectivePaths = getDynamicPaths();
    const scanResult = scanAllPaths();

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          workspace_root: getWorkspaceRoot(),
          search_paths: {
            base: getBasePaths(),
            dynamic: getDynamicPathsOnly(),
            effective: effectivePaths
          },
          path_status: getPathStatus(effectivePaths),
          env: {
            MCP_SKILL_PATHS: process.env.MCP_SKILL_PATHS || null,
            MCP_WORKSPACE_ROOT: process.env.MCP_WORKSPACE_ROOT || null
          },
          skills_found: scanResult.skills.length,
          warnings: scanResult.warnings
        }, null, 2)
      }]
    };
  }
);

// --- Start Server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
