import type { ChangedFile } from "../agents/changedFile.js";
import type { StaticFinding } from "../agents/agentInterface.js";
import { checkSyntax } from "./checkSyntax.js";
import { runEslint } from "./runEslint.js";
import { runSemgrep } from "./runSemgrep.js";

export async function runStaticAnalysis(files: ChangedFile[]): Promise<StaticFinding[]> {
  const [eslint, semgrep, syntax] = await Promise.all([runEslint(files), runSemgrep(files), checkSyntax(files)]);
  return [...eslint, ...semgrep, ...syntax];
}
