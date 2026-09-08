import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

function sourceFilesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFilesIn(full);
    if (!full.endsWith(".ts") && !full.endsWith(".tsx")) return [];
    if (full.endsWith(".test.ts") || full.endsWith(".test.tsx")) return [];
    return [full];
  });
}

/**
 * src/lib holds the parts of this service that are about the service itself: its
 * validation rules, its section definitions, how its questions branch. None of that
 * is a React idea, and keeping React out of it is what makes those parts portable to
 * a differently-rendered version of the same service.
 *
 * That only stays true if something checks. A convention nobody can verify is a
 * convention that quietly stops being true, so this test is the mechanism rather
 * than a note in the README asking people to be careful.
 *
 * If this fails: the logic probably belongs in src/components or src/store instead.
 */
describe("src/lib stays framework-neutral", () => {
  it("contains no React imports", () => {
    const offenders = sourceFilesIn(LIB_DIR)
      .filter((file) => /\bfrom\s+["']react(-dom|-router-dom)?["']/.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(LIB_DIR.length + 1));

    expect(offenders).toEqual([]);
  });

  it("contains no design system component imports", () => {
    const offenders = sourceFilesIn(LIB_DIR)
      .filter((file) => /\bfrom\s+["']@abgov\//.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(LIB_DIR.length + 1));

    expect(offenders).toEqual([]);
  });

  it("actually reads files, so a passing result means something", () => {
    // Guards the two tests above. If the walker returned nothing they would both
    // pass vacuously, and the neutrality check would be worthless without saying so.
    expect(sourceFilesIn(LIB_DIR).length).toBeGreaterThan(0);
  });
});
