import type { ChangedFile } from "../agents/changedFile.js";
import type { StaticFinding } from "../agents/agentInterface.js";
import { runEslint } from "./runEslint.js";
import { runSemgrep } from "./runSemgrep.js";

export async function runStaticAnalysis(files: ChangedFile[]): Promise<StaticFinding[]> {
  const [eslint, semgrep] = await Promise.all([runEslint(files), runSemgrep(files)]);
  return [...eslint, ...semgrep];
}
