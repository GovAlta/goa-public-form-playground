import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { SERVICE_NAME } from "../src/lib/service";

/**
 * KEEPING THIS REPOSITORY'S DESCRIPTION OF ITSELF TRUE.
 *
 * A template's README drifts before its code does, and it drifts quietly. Nobody
 * writes something false; the code moves and the prose stays still, and there is
 * nothing in the build that would ever notice. The repository this template is
 * modelled on shows the end state: its README says React 18.2 while its package.json
 * ships React 19, and it documents two files that were renamed away long ago.
 *
 * A forking team reads the README before they read anything else. It is the one file
 * where being wrong costs the most and gets caught the least.
 *
 * These run as part of `npm test`, which the deploy workflow already runs, so a stale
 * README fails a deploy rather than waiting for somebody to notice.
 *
 * WHAT THESE DELIBERATELY DO NOT DO. They cannot tell whether a sentence is true, only
 * whether the things it names are real. A README that describes the wrong behaviour in
 * correct file names passes every check here. And fork drift, where your copy grows
 * away from this template, is not a defect and is not checked: the code is yours.
 */

const ROOT = process.cwd();

/** Files the README names that are produced by the build, not committed. */
const BUILD_ARTEFACTS = new Set(["404.html"]);

/** Where a path reference could plausibly point. Used to tell a path from prose. */
const SOURCE_DIRS = ["src", "e2e", "scripts", "public", ".github"];
const PATH_PREFIX = new RegExp(`^(${SOURCE_DIRS.join("|")})/`);

const README = readFileSync(join(ROOT, "README.md"), "utf8");

/** README text with fenced code blocks removed, so tree diagrams are not read as paths. */
const readmeProse = README.replace(/```[\s\S]*?```/g, "");

/**
 * Does this reference point at something real?
 *
 * Extensions are optional, because an import specifier does not carry one and neither
 * does a comment that says "see src/lib/service". Both name the same real file, and a
 * check that called them broken would be reporting on TypeScript's module resolution
 * rather than on whether the repository matches its own description.
 */
const exists = (p: string): boolean => {
  const bare = join(ROOT, p.replace(/\/$/, ""));
  return [bare, `${bare}.ts`, `${bare}.tsx`, join(bare, "index.ts")].some((candidate) =>
    existsSync(candidate),
  );
};

/**
 * Path-shaped tokens out of inline `backticks`.
 *
 * Two shapes count: anything under a source directory, and a bare filename with an
 * extension (package.json, vite.config.ts). Excluded: globs, npm package names, URLs,
 * and anything with a space, none of which are repository paths.
 */
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

/** Every source file whose comments might point at something. */
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

    // Without this, a change to the extractor that returned nothing would leave every
    // assertion below true of an empty list, and this test would report success while
    // checking no paths at all.
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
    // index.html cannot import the constant: the title renders before any JavaScript,
    // which is exactly what makes it worth having as a separate copy and exactly what
    // makes it the copy a fork forgets. It is what a bookmark saves and what a search
    // result shows, so a fork that changes SERVICE_NAME and not this ships a browser
    // tab still carrying somebody else's service name.
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

    // Same guard as above. A regex that stopped matching would otherwise turn this
    // into a test that always passes.
    expect(referencesFound).toBeGreaterThan(10);

    expect(broken).toEqual([]);
  });
});
