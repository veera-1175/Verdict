import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse } from "parse5";
import postcss from "postcss";
import type { ChangedFile } from "../agents/changedFile.js";
import type { StaticFinding } from "../agents/agentInterface.js";
import { withTempFiles } from "./tempFiles.js";

const execFileAsync = promisify(execFile);

function finding(file: ChangedFile, line: number | null, message: string): StaticFinding {
  return {
    tool: "syntax",
    file: file.path,
    line,
    rule: "parse",
    message: message.replace(/\s+/g, " ").trim(),
    severity: "error",
  };
}

/** Whatever the CSS parser reports: unclosed blocks, bad at-rules, unknown words, and so on. */
export function checkCss(file: ChangedFile): StaticFinding | null {
  if (!file.content) return null;
  try {
    postcss.parse(file.content, { from: file.path });
    return null;
  } catch (err) {
    const error = err as { line?: number; reason?: string; message?: string };
    return finding(file, error.line ?? null, error.reason || error.message || "CSS syntax error");
  }
}

function checkJson(file: ChangedFile): StaticFinding | null {
  if (!file.content.trim()) return null;
  try {
    JSON.parse(file.content);
    return null;
  } catch (err) {
    return finding(file, null, (err as Error).message);
  }
}

async function checkJavaScript(file: ChangedFile): Promise<StaticFinding | null> {
  if (!file.content.trim()) return null;
  return withTempFiles("verdict-syntax-", [file], async (dir) => {
    try {
      await execFileAsync(process.execPath, ["--check", join(dir, file.path)], {
        windowsHide: true,
      });
      return null;
    } catch (err) {
      const stderr = String((err as { stderr?: string }).stderr ?? (err as Error).message);
      const syntaxLine = stderr
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith("SyntaxError:"));
      const located = stderr.match(/:(\d+)\r?\n/);
      return finding(file, located ? Number(located[1]) : null, syntaxLine ?? "JavaScript syntax error");
    }
  });
}

/** Reports whatever the HTML parser itself reports. No hand-written tag rules. */
export function checkHtml(file: ChangedFile): StaticFinding[] {
  if (!file.content.trim()) return [];
  const findings: StaticFinding[] = [];
  const seen = new Set<string>();
  parse(file.content, {
    onParseError(error) {
      if (error.code === "missing-doctype") return;
      const key = `${error.code}:${error.startLine}:${error.startCol}`;
      if (seen.has(key)) return;
      seen.add(key);
      findings.push(finding(file, error.startLine, error.code.replaceAll("-", " ")));
    },
  });
  return findings;
}

async function checkTypeScript(file: ChangedFile): Promise<StaticFinding | null> {
  if (!file.content.trim()) return null;
  let ts: typeof import("typescript");
  try {
    ts = await import("typescript");
  } catch {
    return null;
  }
  const scriptKind = file.path.endsWith("tsx")
    ? ts.ScriptKind.TSX
    : file.path.endsWith("jsx")
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, scriptKind);
  const diagnostic = (
    source as import("typescript").SourceFile & { parseDiagnostics?: import("typescript").Diagnostic[] }
  ).parseDiagnostics?.[0];
  if (!diagnostic) return null;
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  const line =
    diagnostic.start == null ? null : source.getLineAndCharacterOfPosition(diagnostic.start).line + 1;
  return finding(file, line, message);
}

export async function checkSyntax(files: ChangedFile[]): Promise<StaticFinding[]> {
  const findings: StaticFinding[] = [];

  for (const file of files) {
    const path = file.path.toLowerCase();
    let result: StaticFinding | null = null;
    if (path.endsWith(".html") || path.endsWith(".htm")) {
      findings.push(...checkHtml(file));
      continue;
    }
    if (path.endsWith(".css")) result = checkCss(file);
    else if (path.endsWith(".json")) result = checkJson(file);
    else if (/\.(js|mjs|cjs)$/.test(path)) result = await checkJavaScript(file);
    else if (/\.(ts|tsx|jsx)$/.test(path)) result = await checkTypeScript(file);
    if (result) findings.push(result);
  }

  return findings;
}
