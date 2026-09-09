import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { SERVICE_NAME } from "../src/lib/service";

/**
 * Keeps the README true to the tree: the files and folders it names must exist, every
 * src/ folder must be mentioned, and the title must match SERVICE_NAME. Names, not
 * sentences: a wrong sentence in the right file name passes here.
 */

const ROOT = process.cwd();

/** Files the README names that are produced by the build, not committed. */
const BUILD_ARTEFACTS = new Set(["404.html"]);

const SOURCE_DIRS = ["src", "e2e", "scripts", "public", ".github"];
const PATH_PREFIX = new RegExp(`^(${SOURCE_DIRS.join("|")})/`);

const README = readFileSync(join(ROOT, "README.md"), "utf8");

const readmeProse = README.replace(/```[\s\S]*?```/g, "");

/** Extensions are optional: an import specifier and a comment can name the same file. */
const exists = (p: string): boolean => {
  const bare = join(ROOT, p.replace(/\/$/, ""));
  return [bare, `${bare}.ts`, `${bare}.tsx`, join(bare, "index.ts")].some((candidate) =>
    existsSync(candidate),
  );
};

/** Path-shaped tokens in backticks: under a source directory, or a bare filename with an extension. */
function pathsNamedInProse(): string[] {
  const backticked = [...readmeProse.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());

  return backticked.filter((token) => {
    if (token.includes("*") || token.includes(" ") || token.includes("@")) return false;
    if (token.startsWith("http")) return false;
    if (BUILD_ARTEFACTS.has(token)) return false;
    if (PATH_PREFIX.test(token)) return true;
    return !token.includes("/") && /\.(json|html|ts|tsx|css|md|yml)$/.test(token);
  });
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(ROOT, rel)).isDirectory()) sourceFiles(rel, found);
    else if (/\.(ts|tsx|html|yml)$/.test(entry)) found.push(rel);
  }
  return found;
}

describe("the README describes this repository", () => {
  it("names only files and folders that exist", () => {
    const named = pathsNamedInProse();

    // A floor, so an extractor that returned nothing cannot pass vacuously.
    expect(named.length).toBeGreaterThan(8);

    expect(named.filter((p) => !exists(p))).toEqual([]);
  });

  it("mentions every area of the source, so a new one cannot appear silently", () => {
    const areas = readdirSync(join(ROOT, "src")).filter((entry) =>
      statSync(join(ROOT, "src", entry)).isDirectory(),
    );

    expect(areas.length).toBeGreaterThan(2);

    expect(areas.filter((area) => !README.includes(`${area}/`))).toEqual([]);
  });
});

describe("the service name", () => {
  it("is the same in index.html as in the constant the app reads", () => {
    // index.html cannot import the constant, and a fork that changes one and not the
    // other ships the wrong tab title.
    const title = readFileSync(join(ROOT, "index.html"), "utf8").match(
      /<title>([^<]*)<\/title>/,
    )?.[1];

    expect(title).toBeDefined();
    expect(title).toBe(SERVICE_NAME);
  });
});

describe("comments in the source", () => {
  it("point at files that exist", () => {
    const files = sourceFiles("src")
      .concat(sourceFiles("e2e"), sourceFiles("scripts"), sourceFiles(".github"))
      .concat("index.html");

    expect(files.length).toBeGreaterThan(20);

    const broken: string[] = [];
    let referencesFound = 0;

    for (const file of files) {
      const text = readFileSync(join(ROOT, file), "utf8");
      const referenced = [...text.matchAll(/\b(?:src|e2e|scripts|public)\/[A-Za-z0-9._/-]+/g)]
        .map((m) => m[0].replace(/[.,;:)]+$/, ""))
        .filter((p) => !p.includes("*"));

      for (const path of referenced) {
        referencesFound += 1;
        if (!exists(path)) broken.push(`${relative(ROOT, join(ROOT, file))} -> ${path}`);
      }
    }

    // Same floor: a regex that stopped matching would make this always pass.
    expect(referencesFound).toBeGreaterThan(5);

    expect(broken).toEqual([]);
  });
});
