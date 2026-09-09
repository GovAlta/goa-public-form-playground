import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = dirname(LIB_DIR);
const SECTIONS_DIR = join(SRC_DIR, "sections");

function sourceFilesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFilesIn(full);
    if (!full.endsWith(".ts") && !full.endsWith(".tsx")) return [];
    if (full.endsWith(".test.ts") || full.endsWith(".test.tsx")) return [];
    return [full];
  });
}

function sectionRules(): string[] {
  return readdirSync(SECTIONS_DIR)
    .map((section) => join(SECTIONS_DIR, section, "rules.ts"))
    .filter((file) => existsSync(file));
}

/**
 * The rules are about the service, not about React, and keeping React out is what makes
 * them portable. If this fails, the logic belongs in src/components, src/store, or the
 * section's pages.tsx.
 */
describe("src/lib and the sections' rules stay framework-neutral", () => {
  const files = () => [...sourceFilesIn(LIB_DIR), ...sectionRules()];
  const name = (file: string) => file.slice(SRC_DIR.length + 1);

  it("contain no React imports", () => {
    const offenders = files()
      .filter((file) =>
        /\bfrom\s+["']react(-dom|-router-dom)?["']/.test(readFileSync(file, "utf8")),
      )
      .map(name);

    expect(offenders).toEqual([]);
  });

  it("contain no design system component imports", () => {
    const offenders = files()
      .filter((file) => /\bfrom\s+["']@abgov\//.test(readFileSync(file, "utf8")))
      .map(name);

    expect(offenders).toEqual([]);
  });

  it("actually reads files, so a passing result means something", () => {
    // Guards the two above against passing vacuously.
    expect(sourceFilesIn(LIB_DIR).length).toBeGreaterThan(0);
    expect(sectionRules().length).toBeGreaterThan(0);
  });
});
