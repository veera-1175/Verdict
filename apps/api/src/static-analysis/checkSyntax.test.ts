import { describe, expect, it } from "vitest";
import { checkCss, checkHtml, checkSyntax } from "./checkSyntax.js";
import type { ChangedFile } from "../agents/changedFile.js";

function file(path: string, content: string): ChangedFile {
  return { path, content, patch: "", status: "modified" };
}

describe("checkSyntax", () => {
  it("accepts valid CSS", () => {
    expect(checkCss(file("app.css", ".card { color: red; }\n"))).toBeNull();
  });

  it("reports the parser message for an unclosed block", () => {
    const found = checkCss(file("app.css", ".card {\n  color: red;\n"));
    expect(found?.message.toLowerCase()).toContain("unclosed");
    expect(found?.line).toBe(1);
  });

  it("reports a different CSS problem with a different message", () => {
    const found = checkCss(file("app.css", ".card { @ }\n"));
    expect(found?.message.toLowerCase()).toContain("at-rule");
  });

  it("reports a JavaScript parser error", async () => {
    const found = await checkSyntax([file("app.js", "function (\n")]);
    expect(found).toHaveLength(1);
    expect(found[0].message).toMatch(/SyntaxError/);
  });

  it("accepts valid JavaScript", async () => {
    const found = await checkSyntax([file("app.js", "const n = 1;\n")]);
    expect(found).toHaveLength(0);
  });

  it("accepts an HTML document that has a body tag", () => {
    const found = checkHtml(
      file("index.html", "<!DOCTYPE html><html><head><title>T</title></head><body><p>Hi</p></body></html>"),
    );
    expect(found).toHaveLength(0);
  });

  it("reports an HTML error in the parser's own words", () => {
    const found = checkHtml(file("index.html", "<!DOCTYPE html><html><body><div class=</body></html>"));
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].message.length).toBeGreaterThan(0);
  });

  it("does not invent a finding when the only change is a missing body tag", () => {
    const found = checkHtml(
      file(
        "index.html",
        "<!DOCTYPE html><html><head><title>T</title></head><header>Hi</header></body></html>",
      ),
    );
    expect(found.some((item) => item.message.toLowerCase().includes("inserted a body"))).toBe(false);
  });

  it("does not require a body tag on an HTML fragment", () => {
    const found = checkHtml(file("partial.html", "<header>Hi</header>"));
    expect(found).toHaveLength(0);
  });
});
