import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChangedFile } from "../agents/changedFile.js";
import type { StaticFinding } from "../agents/agentInterface.js";
import { withTempFiles } from "./tempFiles.js";

const execFileAsync = promisify(execFile);

export async function runSemgrep(files: ChangedFile[]): Promise<StaticFinding[]> {
  const withContent = files.filter((f) => f.content.length > 0);
  if (!withContent.length) return [];

  try {
    return await withTempFiles("verdict-semgrep-", withContent, async (dir) => {
      const { stdout } = await execFileAsync(
        "semgrep",
        ["scan", "--json", "--quiet", "--config", "p/default", dir],
        { maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      ).catch(() => ({ stdout: '{"results":[]}' }));

      const data = JSON.parse(stdout) as {
        results?: Array<{
          path: string;
          check_id: string;
          extra?: { message?: string; severity?: string };
          start?: { line?: number };
        }>;
      };

      return (data.results ?? []).map((r) => ({
        tool: "semgrep" as const,
        file: r.path.replace(dir, "").replace(/^[/\\]/, ""),
        line: r.start?.line ?? null,
        rule: r.check_id,
        message: r.extra?.message ?? r.check_id,
        severity: r.extra?.severity ?? "warning",
      }));
    });
  } catch (err) {
    console.warn("[semgrep] skipped:", (err as Error).message);
    return [];
  }
}
