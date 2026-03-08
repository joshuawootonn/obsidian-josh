import { describe, expect, it, vi } from "vitest";

import { ensureMissingDailyNotes, extractIsoDateLinks } from "./dailyNoteLinks";

describe("extractIsoDateLinks", () => {
  it("finds unique ISO date wikilinks", () => {
    const dates = extractIsoDateLinks(
      [
        "Plan for [[2026-03-08]]",
        "Tomorrow is [[2026-03-09|tomorrow]]",
        "Duplicate [[2026-03-08]]",
      ].join("\n"),
    );

    expect(dates).toEqual(["2026-03-08", "2026-03-09"]);
  });

  it("ignores non-date wikilinks", () => {
    const dates = extractIsoDateLinks("[[People/Josh]] [[March 8, 2026]]");

    expect(dates).toEqual([]);
  });
});

describe("ensureMissingDailyNotes", () => {
  it("creates an unresolved daily note in the configured folder", async () => {
    const adapter = {
      resolveLink: vi.fn(() => false),
      exists: vi.fn(() => false),
      ensureFolder: vi.fn(async () => undefined),
      getInitialContents: vi.fn(async () => "# Daily Template\n"),
      create: vi.fn(async () => undefined),
    };

    await ensureMissingDailyNotes({
      content: "Reference [[2026-03-08]]",
      dailyFolder: "Daily",
      adapter,
      pendingPaths: new Set(),
    });

    expect(adapter.ensureFolder).toHaveBeenCalledWith("Daily");
    expect(adapter.getInitialContents).toHaveBeenCalledTimes(1);
    expect(adapter.create).toHaveBeenCalledWith("Daily/2026-03-08.md", "# Daily Template\n");
  });

  it("does not create a note when the link already resolves", async () => {
    const adapter = {
      resolveLink: vi.fn(() => true),
      exists: vi.fn(() => false),
      ensureFolder: vi.fn(async () => undefined),
      getInitialContents: vi.fn(async () => "# Daily Template\n"),
      create: vi.fn(async () => undefined),
    };

    await ensureMissingDailyNotes({
      content: "Reference [[2026-03-08]]",
      dailyFolder: "Daily",
      adapter,
      pendingPaths: new Set(),
    });

    expect(adapter.ensureFolder).not.toHaveBeenCalled();
    expect(adapter.getInitialContents).not.toHaveBeenCalled();
    expect(adapter.create).not.toHaveBeenCalled();
  });

  it("does not recreate a pending or existing daily note", async () => {
    const adapter = {
      resolveLink: vi.fn(() => false),
      exists: vi.fn((path: string) => path === "Daily/2026-03-09.md"),
      ensureFolder: vi.fn(async () => undefined),
      getInitialContents: vi.fn(async () => "# Daily Template\n"),
      create: vi.fn(async () => undefined),
    };

    await ensureMissingDailyNotes({
      content: "Reference [[2026-03-08]] and [[2026-03-09]]",
      dailyFolder: "Daily",
      adapter,
      pendingPaths: new Set(["Daily/2026-03-08.md"]),
    });

    expect(adapter.create).not.toHaveBeenCalled();
  });

  it("reuses the same template contents across multiple created notes", async () => {
    const adapter = {
      resolveLink: vi.fn(() => false),
      exists: vi.fn(() => false),
      ensureFolder: vi.fn(async () => undefined),
      getInitialContents: vi.fn(async () => "# Daily Template\n"),
      create: vi.fn(async () => undefined),
    };

    await ensureMissingDailyNotes({
      content: "Reference [[2026-03-08]] and [[2026-03-09]]",
      dailyFolder: "Daily",
      adapter,
      pendingPaths: new Set(),
    });

    expect(adapter.getInitialContents).toHaveBeenCalledTimes(1);
    expect(adapter.create).toHaveBeenNthCalledWith(1, "Daily/2026-03-08.md", "# Daily Template\n");
    expect(adapter.create).toHaveBeenNthCalledWith(2, "Daily/2026-03-09.md", "# Daily Template\n");
  });
});
