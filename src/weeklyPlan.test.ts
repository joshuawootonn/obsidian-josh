import { describe, expect, it } from "vitest";

import { findLatestWeeklyPlan } from "./weeklyPlan";

const file = (path: string, mtime: number) => {
  const basename = path.split("/").pop()?.replace(/\.md$/i, "") ?? path;

  return {
    path,
    basename,
    stat: {
      mtime,
    },
  };
};

describe("findLatestWeeklyPlan", () => {
  it("returns the newest weekly plan by ISO date in the file name", () => {
    const result = findLatestWeeklyPlan(
      [
        file("Log/2026-02-22 W09 — Weekly Plan.md", 10),
        file("Log/2026-03-01 W10 — Weekly Plan.md", 5),
        file("Log/2026-02-15 W08 — Weekly Plan.md", 20),
      ],
      "Log",
      "Weekly Plan",
    );

    expect(result?.path).toBe("Log/2026-03-01 W10 — Weekly Plan.md");
  });

  it("falls back to modified time when dates are missing", () => {
    const result = findLatestWeeklyPlan(
      [
        file("Log/@March 1, 2023 - Weekly Plan.md", 10),
        file("Log/@March 8, 2023 - Weekly Plan.md", 20),
      ],
      "Log",
      "Weekly Plan",
    );

    expect(result?.path).toBe("Log/@March 8, 2023 - Weekly Plan.md");
  });

  it("ignores non-weekly-plan notes in the same folder", () => {
    const result = findLatestWeeklyPlan(
      [
        file("Log/2026-03-01 W10 — Weekly Plan.md", 5),
        file("Log/Meeting with Eden.md", 50),
      ],
      "Log",
      "Weekly Plan",
    );

    expect(result?.path).toBe("Log/2026-03-01 W10 — Weekly Plan.md");
  });

  it("returns null when no matching weekly plan exists", () => {
    const result = findLatestWeeklyPlan(
      [file("Projects/TTW.md", 10)],
      "Log",
      "Weekly Plan",
    );

    expect(result).toBeNull();
  });

  it("can find latest monthly review notes by title fragment", () => {
    const result = findLatestWeeklyPlan(
      [
        file("Log/2026-01-31 - Monthly Review.md", 10),
        file("Log/2026-02-28 - Monthly Review.md", 5),
      ],
      "Log",
      "Monthly Review",
    );

    expect(result?.path).toBe("Log/2026-02-28 - Monthly Review.md");
  });

  it("can find latest quarterly review notes by title fragment", () => {
    const result = findLatestWeeklyPlan(
      [
        file("Log/2025-10-01 - Quarterly Review.md", 10),
        file("Log/2026-01-01 - Quarterly Review.md", 5),
      ],
      "Log",
      "Quarterly Review",
    );

    expect(result?.path).toBe("Log/2026-01-01 - Quarterly Review.md");
  });
});
