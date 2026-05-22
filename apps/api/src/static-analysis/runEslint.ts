import { platform } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChangedFile } from "../agents/changedFile.js";
import type { StaticFinding } from "../agents/agentInterface.js";
import { withTempFiles } from "./tempFiles.js";

const execFileAsync = promisify(execFile);
const npxCmd = platform() === "win32" ? "npx.cmd" : "npx";

function parseEslintJson(stdout: string, cwd: string): StaticFinding[] {
  try {
    const parsed = JSON.parse(stdout) as Array<{
      filePath: string;
      messages: Array<{ line?: number; ruleId?: string; message: string; severity: number }>;
    }>;
    const findings: StaticFinding[] = [];
    for (const file of parsed) {
      const rel = file.filePath.replace(cwd, "").replace(/^[/\\]/, "");
      for (const msg of file.messages) {
        findings.push({
          tool: "eslint",
          file: rel,
          line: msg.line ?? null,
          rule: msg.ruleId ?? "eslint",
          message: msg.message,
          severity: msg.severity >= 2 ? "error" : "warning",
        });
      }
    }
    return findings;
  } catch {
    return [];
  }
}

export async function runEslint(files: ChangedFile[]): Promise<StaticFinding[]> {
  const jsFiles = files.filter((f) => /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(f.path) && f.content);
  if (!jsFiles.length) return [];

  try {
    return await withTempFiles("verdict-eslint-", jsFiles, async (dir) => {
      const targets = jsFiles.map((f) => join(dir, f.path));
      const { stdout } = await execFileAsync(
        npxCmd,
        ["eslint", "--format", "json", "--no-eslintrc", ...targets],
        { cwd: dir, env: process.env, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      ).catch((err: { stdout?: string }) => ({ stdout: err.stdout ?? "[]" }));
      return parseEslintJson(stdout, dir);
    });
  } catch (err) {
    console.warn("[eslint] skipped:", (err as Error).message);
    return [];
  }
}
