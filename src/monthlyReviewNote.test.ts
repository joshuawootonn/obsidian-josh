import { describe, expect, it, vi } from "vitest";

import type { NoteFactoryAdapter } from "./noteFactory";
import {
  createOrOpenNextMonthlyReview,
  getNextMonthlyReviewDate,
  renderMonthlyReviewTemplate,
  resolveMonthlyReviewPath,
} from "./monthlyReviewNote";

interface FakeFile {
  path: string;
  contents?: string;
}

describe("getNextMonthlyReviewDate", () => {
  it("returns the first day of next month", () => {
    const result = getNextMonthlyReviewDate(new Date("2026-03-14T12:00:00"));

    expect(result).toEqual(new Date(2026, 3, 1));
  });

  it("crosses the year boundary", () => {
    const result = getNextMonthlyReviewDate(new Date("2025-12-31T12:00:00"));

    expect(result).toEqual(new Date(2026, 0, 1));
  });
});

describe("resolveMonthlyReviewPath", () => {
  it("builds the next monthly review path with a month-year title", () => {
    const path = resolveMonthlyReviewPath(new Date(2026, 3, 1), "Log");

    expect(path).toBe("Log/April 2026.md");
  });
});

describe("renderMonthlyReviewTemplate", () => {
  it("replaces monthly review date placeholders", () => {
    const contents = renderMonthlyReviewTemplate(
      "---\nDate: {{date:YYYY-MM-DD}}\nCreated: {{date:YYYY-MM-DD}}\n---\n",
      new Date(2026, 3, 1),
    );

    expect(contents).toBe("---\nDate: 2026-04-01\nCreated: 2026-04-01\n---\n");
  });
});

describe("createOrOpenNextMonthlyReview", () => {
  const definition = {
    folderPath: "Log",
    templatePath: "Templates/Monthly Review.md",
  };

  it("creates and opens next month's monthly review from the rendered template", async () => {
    const templateFile: FakeFile = {
      path: "Templates/Monthly Review.md",
      contents: "---\nDate: {{date:YYYY-MM-DD}}\n---\n",
    };
    const createdFile: FakeFile = { path: "Log/April 2026.md" };
    const adapter: NoteFactoryAdapter<FakeFile> = {
      getTemplateFile: vi.fn((path: string) => (path === templateFile.path ? templateFile : null)),
      getFile: vi.fn(() => null),
      read: vi.fn(async (file: FakeFile) => file.contents ?? ""),
      exists: vi.fn(() => false),
      ensureFolder: vi.fn(async () => undefined),
      create: vi.fn(async () => createdFile),
      open: vi.fn(async () => undefined),
    };

    const result = await createOrOpenNextMonthlyReview(
      adapter,
      definition,
      new Date("2026-03-14"),
    );

    expect(result).toBe(createdFile);
    expect(adapter.ensureFolder).toHaveBeenCalledWith("Log");
    expect(adapter.create).toHaveBeenCalledWith(
      "Log/April 2026.md",
      "---\nDate: 2026-04-01\n---\n",
    );
    expect(adapter.open).toHaveBeenCalledWith(createdFile);
  });

  it("opens the existing monthly review instead of creating a duplicate", async () => {
    const templateFile: FakeFile = {
      path: "Templates/Monthly Review.md",
      contents: "---\nDate: {{date:YYYY-MM-DD}}\n---\n",
    };
    const existingFile: FakeFile = { path: "Log/April 2026.md" };
    const adapter: NoteFactoryAdapter<FakeFile> = {
      getTemplateFile: vi.fn((path: string) => (path === templateFile.path ? templateFile : null)),
      getFile: vi.fn((path: string) => (path === existingFile.path ? existingFile : null)),
      read: vi.fn(async (file: FakeFile) => file.contents ?? ""),
      exists: vi.fn((path: string) => path === existingFile.path),
      ensureFolder: vi.fn(async () => undefined),
      create: vi.fn(),
      open: vi.fn(async () => undefined),
    };

    const result = await createOrOpenNextMonthlyReview(
      adapter,
      definition,
      new Date("2026-03-14"),
    );

    expect(result).toBe(existingFile);
    expect(adapter.ensureFolder).not.toHaveBeenCalled();
    expect(adapter.create).not.toHaveBeenCalled();
    expect(adapter.open).toHaveBeenCalledWith(existingFile);
  });
});
