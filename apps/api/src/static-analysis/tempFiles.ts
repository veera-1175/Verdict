import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import type { ChangedFile } from "../agents/changedFile.js";

/** Write changed files into a temp dir; always cleans up. */
export async function withTempFiles<T>(
  prefix: string,
  files: ChangedFile[],
  fn: (dir: string, written: ChangedFile[]) => Promise<T>,
): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try {
    for (const file of files) {
      const full = join(dir, file.path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, file.content, "utf8");
    }
    return await fn(dir, files);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
