import { describe, expect, it, vi } from "vitest";

import {
  createOrOpenNextWeeklyPlan,
  getNextWeekStart,
  renderWeeklyPlanTemplate,
  resolveWeeklyPlanPath,
} from "./weeklyPlanNote";
import type { NoteFactoryAdapter } from "./noteFactory";

interface FakeFile {
  path: string;
  contents?: string;
}

describe("getNextWeekStart", () => {
  it("returns the next Sunday for a mid-week date", () => {
    const result = getNextWeekStart(new Date("2026-03-14T12:00:00"));

    expect(result).toEqual(new Date(2026, 2, 15));
  });

  it("crosses the year boundary", () => {
    const result = getNextWeekStart(new Date("2025-12-31T12:00:00"));

    expect(result).toEqual(new Date(2026, 0, 4));
  });
});

describe("resolveWeeklyPlanPath", () => {
  it("builds the next weekly plan path with an ISO date and week token", () => {
    const path = resolveWeeklyPlanPath(new Date(2026, 2, 15), "Log", "Weekly Plan");

    expect(path).toBe("Log/2026-03-15 W12 — Weekly Plan.md");
  });
});

describe("renderWeeklyPlanTemplate", () => {
  it("replaces weekly plan date placeholders", () => {
    const contents = renderWeeklyPlanTemplate(
      "---\ndate: {{date:YYYY-MM-DD}}\nCreated: {{date:YYYY-MM-DD}}\n---\n",
      new Date(2026, 2, 15),
    );

    expect(contents).toBe("---\ndate: 2026-03-15\nCreated: 2026-03-15\n---\n");
  });
});

describe("createOrOpenNextWeeklyPlan", () => {
  const definition = {
    folderPath: "Log",
    templatePath: "Templates/Weekly Plan.md",
    title: "Weekly Plan",
  };

  it("creates and opens next week's weekly plan from the rendered template", async () => {
    const templateFile: FakeFile = {
      path: "Templates/Weekly Plan.md",
      contents: "---\ndate: {{date:YYYY-MM-DD}}\n---\n",
    };
    const createdFile: FakeFile = { path: "Log/2026-03-15 W12 — Weekly Plan.md" };
    const adapter: NoteFactoryAdapter<FakeFile> = {
      getTemplateFile: vi.fn((path: string) => (path === templateFile.path ? templateFile : null)),
      getFile: vi.fn(() => null),
      read: vi.fn(async (file: FakeFile) => file.contents ?? ""),
      exists: vi.fn(() => false),
      ensureFolder: vi.fn(async () => undefined),
      create: vi.fn(async () => createdFile),
      open: vi.fn(async () => undefined),
    };

    const result = await createOrOpenNextWeeklyPlan(adapter, definition, new Date("2026-03-14"));

    expect(result).toBe(createdFile);
    expect(adapter.ensureFolder).toHaveBeenCalledWith("Log");
    expect(adapter.create).toHaveBeenCalledWith(
      "Log/2026-03-15 W12 — Weekly Plan.md",
      "---\ndate: 2026-03-15\n---\n",
    );
    expect(adapter.open).toHaveBeenCalledWith(createdFile);
  });

  it("opens the existing weekly plan instead of creating a duplicate", async () => {
    const templateFile: FakeFile = {
      path: "Templates/Weekly Plan.md",
      contents: "---\ndate: {{date:YYYY-MM-DD}}\n---\n",
    };
    const existingFile: FakeFile = { path: "Log/2026-03-15 W12 — Weekly Plan.md" };
    const adapter: NoteFactoryAdapter<FakeFile> = {
      getTemplateFile: vi.fn((path: string) => (path === templateFile.path ? templateFile : null)),
      getFile: vi.fn((path: string) => (path === existingFile.path ? existingFile : null)),
      read: vi.fn(async (file: FakeFile) => file.contents ?? ""),
      exists: vi.fn((path: string) => path === existingFile.path),
      ensureFolder: vi.fn(async () => undefined),
      create: vi.fn(),
      open: vi.fn(async () => undefined),
    };

    const result = await createOrOpenNextWeeklyPlan(adapter, definition, new Date("2026-03-14"));

    expect(result).toBe(existingFile);
    expect(adapter.ensureFolder).not.toHaveBeenCalled();
    expect(adapter.create).not.toHaveBeenCalled();
    expect(adapter.open).toHaveBeenCalledWith(existingFile);
  });
});
