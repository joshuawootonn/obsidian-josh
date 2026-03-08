export interface WeeklyPlanFileLike {
  path: string;
  basename: string;
  stat: {
    mtime: number;
  };
}

export function findLatestWeeklyPlan<FileRef extends WeeklyPlanFileLike>(
  files: FileRef[],
  folderPath: string,
  titleFragment: string,
): FileRef | null {
  const normalizedFolder = trimSlashes(folderPath).toLowerCase();
  const normalizedTitleFragment = titleFragment.trim().toLowerCase();

  const matchingFiles = files.filter((file) => {
    const normalizedPath = file.path.toLowerCase();
    const isInFolder =
      normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
    const matchesTitle =
      normalizedTitleFragment.length === 0 ||
      file.basename.toLowerCase().includes(normalizedTitleFragment);

    return isInFolder && matchesTitle;
  });

  if (matchingFiles.length === 0) {
    return null;
  }

  return [...matchingFiles].sort(compareWeeklyPlanFiles)[0] ?? null;
}

function compareWeeklyPlanFiles(left: WeeklyPlanFileLike, right: WeeklyPlanFileLike): number {
  const leftDate = extractFirstIsoDate(left.basename);
  const rightDate = extractFirstIsoDate(right.basename);

  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }

  if (left.stat.mtime !== right.stat.mtime) {
    return right.stat.mtime - left.stat.mtime;
  }

  return right.path.localeCompare(left.path);
}

function extractFirstIsoDate(value: string): string {
  const match = value.match(/\d{4}-\d{1,2}-\d{1,2}/);

  if (!match) {
    return "";
  }

  const [year, month, day] = match[0].split("-");

  return [year, month.padStart(2, "0"), day.padStart(2, "0")].join("-");
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}
