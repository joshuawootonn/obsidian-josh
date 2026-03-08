import { describe, expect, it, vi } from "vitest";

import {
  parseCoreDailyTemplatePath,
  parsePeriodicNotesDailyTemplatePath,
  resolveDailyTemplateContents,
} from "./dailyNoteTemplate";

describe("parsePeriodicNotesDailyTemplatePath", () => {
  it("returns the periodic notes daily template path", () => {
    expect(
      parsePeriodicNotesDailyTemplatePath(
        JSON.stringify({
          daily: {
            folder: "Daily",
            template: "Templates/Daily.md",
          },
        }),
      ),
    ).toBe("Templates/Daily.md");
  });

  it("returns null when the periodic notes template is blank", () => {
    expect(
      parsePeriodicNotesDailyTemplatePath(
        JSON.stringify({
          daily: {
            template: "",
          },
        }),
      ),
    ).toBeNull();
  });
});

describe("parseCoreDailyTemplatePath", () => {
  it("returns the core daily notes template path", () => {
    expect(
      parseCoreDailyTemplatePath(
        JSON.stringify({
          folder: "Daily",
          template: "Templates/Daily.md",
        }),
      ),
    ).toBe("Templates/Daily.md");
  });
});

describe("resolveDailyTemplateContents", () => {
  it("prefers the periodic notes daily template", async () => {
    const readConfig = vi.fn(async (path: string) => {
      if (path.endsWith("plugins/periodic-notes/data.json")) {
        return JSON.stringify({
          daily: {
            template: "Templates/Periodic Daily.md",
          },
        });
      }

      return JSON.stringify({
        template: "Templates/Core Daily.md",
      });
    });
    const readTemplate = vi.fn(async (path: string) =>
      path === "Templates/Periodic Daily.md" ? "# Periodic Daily\n" : "# Core Daily\n",
    );

    const contents = await resolveDailyTemplateContents(".obsidian", {
      readConfig,
      readTemplate,
    });

    expect(contents).toBe("# Periodic Daily\n");
    expect(readTemplate).toHaveBeenCalledWith("Templates/Periodic Daily.md");
  });

  it("falls back to the core daily notes template", async () => {
    const readConfig = vi.fn(async (path: string) => {
      if (path.endsWith("plugins/periodic-notes/data.json")) {
        return JSON.stringify({
          daily: {
            template: "",
          },
        });
      }

      return JSON.stringify({
        template: "Templates/Core Daily.md",
      });
    });
    const readTemplate = vi.fn(async () => "# Core Daily\n");

    const contents = await resolveDailyTemplateContents(".obsidian", {
      readConfig,
      readTemplate,
    });

    expect(contents).toBe("# Core Daily\n");
    expect(readTemplate).toHaveBeenCalledWith("Templates/Core Daily.md");
  });

  it("returns an empty string when no daily template is configured", async () => {
    const contents = await resolveDailyTemplateContents(".obsidian", {
      readConfig: vi.fn(async () => JSON.stringify({})),
      readTemplate: vi.fn(async () => null),
    });

    expect(contents).toBe("");
  });
});
