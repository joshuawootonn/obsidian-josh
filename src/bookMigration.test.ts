import { describe, expect, it } from "vitest";

import {
  DEFAULT_BOOK_MIGRATION_EXCLUDES,
  buildBasenameCounts,
  findTopLevelFlatBookNotes,
  planBookMigrations,
  rewriteWikiLinksForBookMigrations,
} from "./bookMigration";

describe("findTopLevelFlatBookNotes", () => {
  it("finds only top-level markdown files directly under Books", () => {
    expect(
      findTopLevelFlatBookNotes(
        [
          "Books/Deep Work.md",
          "Books/Job/Job.md",
          "Books/Psalms/Chapters/131.md",
          "People/Josh.md",
        ],
        "Books",
        DEFAULT_BOOK_MIGRATION_EXCLUDES,
      ),
    ).toEqual(["Books/Deep Work.md"]);
  });

  it("skips excluded basenames", () => {
    expect(
      findTopLevelFlatBookNotes(["Books/Books.md", "Books/Deep Work.md"], "Books", ["Books"]),
    ).toEqual(["Books/Deep Work.md"]);
  });
});

describe("planBookMigrations", () => {
  it("plans moves into self-titled book folders", () => {
    const result = planBookMigrations(
      ["Books/Deep Work.md", "Books/Job/Job.md"],
      ["Books", "Books/Job"],
      "Books",
      DEFAULT_BOOK_MIGRATION_EXCLUDES,
    );

    expect(result.conflicts).toEqual([]);
    expect(result.migrations).toEqual([
      {
        basename: "Deep Work",
        oldPath: "Books/Deep Work.md",
        oldLinkPath: "Books/Deep Work",
        newFolderPath: "Books/Deep Work",
        newPath: "Books/Deep Work/Deep Work.md",
        newLinkPath: "Books/Deep Work/Deep Work",
      },
    ]);
  });

  it("reports conflicts when the target root note already exists", () => {
    const result = planBookMigrations(
      ["Books/Deep Work.md", "Books/Deep Work/Deep Work.md"],
      ["Books", "Books/Deep Work"],
      "Books",
      DEFAULT_BOOK_MIGRATION_EXCLUDES,
    );

    expect(result.conflicts).toEqual([
      "Target note already exists for Books/Deep Work.md: Books/Deep Work/Deep Work.md",
    ]);
  });
});

describe("rewriteWikiLinksForBookMigrations", () => {
  it("rewrites basename, explicit path, embeds, and aliased links", () => {
    const migrations = planBookMigrations(
      ["Books/Deep Work.md"],
      ["Books"],
      "Books",
      DEFAULT_BOOK_MIGRATION_EXCLUDES,
    ).migrations;
    const basenameCounts = buildBasenameCounts(["Books/Deep Work.md", "People/Josh.md"]);
    const result = rewriteWikiLinksForBookMigrations(
      [
        "[[Deep Work]]",
        "[[Books/Deep Work]]",
        "![[Deep Work#Summary|book embed]]",
      ].join("\n"),
      migrations,
      basenameCounts,
    );

    expect(result.rewriteCount).toBe(3);
    expect(result.content).toContain("[[Books/Deep Work/Deep Work]]");
    expect(result.content).toContain("[[Books/Deep Work/Deep Work]]");
    expect(result.content).toContain("![[Books/Deep Work/Deep Work#Summary|book embed]]");
    expect(result.ambiguousTargets).toEqual([]);
  });

  it("leaves ambiguous basename-only links unchanged", () => {
    const migrations = planBookMigrations(
      ["Books/Job.md"],
      ["Books"],
      "Books",
      DEFAULT_BOOK_MIGRATION_EXCLUDES,
    ).migrations;
    const basenameCounts = buildBasenameCounts(["Books/Job.md", "People/Job.md"]);
    const result = rewriteWikiLinksForBookMigrations("[[Job]] [[Books/Job]]", migrations, basenameCounts);

    expect(result.content).toBe("[[Job]] [[Books/Job/Job]]");
    expect(result.rewriteCount).toBe(1);
    expect(result.ambiguousTargets).toEqual(["Job"]);
  });
});
