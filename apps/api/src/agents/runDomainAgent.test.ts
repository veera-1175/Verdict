import { describe, expect, it } from "vitest";
import type { ChangedFile } from "./changedFile.js";
import { buildFileContext, numberFile, verifyIssues } from "./runDomainAgent.js";

const css: ChangedFile = {
  path: "style.css",
  content: "* {\n  box-sizing: border-box;\n\nbody \n  margin: 0;\n}\n",
  patch: "-body {\n+body ",
  status: "modified",
};

describe("numbered source", () => {
  it("prefixes every line so an agent can cite it", () => {
    const numbered = numberFile("a\nb");
    expect(numbered).toContain("1| a");
    expect(numbered).toContain("2| b");
  });

  it("includes the full source in the agent prompt", () => {
    const prompt = buildFileContext([css], []);
    expect(prompt).toContain("FILE: style.css");
    expect(prompt).toContain("body");
  });
});

describe("verifyIssues", () => {
  it("keeps a defect whose evidence is copied from the file and fixes the line", () => {
    const kept = verifyIssues(
      [
        {
          file: "style.css",
          line: 99,
          title: "Selector has no block",
          description: "The rule never opens.",
          evidence: "body ",
          severity: "high",
          suggestedFix: "Write body {",
          selfConfidence: 80,
        },
      ],
      [css],
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].line).toBe(4);
    expect(kept[0].file).toBe("style.css");
  });

  it("drops an issue the agent cannot quote from the file", () => {
    const kept = verifyIssues(
      [
        {
          file: "style.css",
          line: 1,
          title: "Imagined bug",
          description: "Not in the file.",
          evidence: "this line was never in the file",
          severity: "low",
          suggestedFix: "Nothing",
          selfConfidence: 10,
        },
      ],
      [css],
    );
    expect(kept).toHaveLength(0);
  });
});
