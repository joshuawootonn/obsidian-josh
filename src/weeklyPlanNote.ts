import type { NoteFactoryAdapter } from "./noteFactory";

export interface WeeklyPlanDefinition {
  folderPath: string;
  templatePath: string;
  title: string;
}

export async function createOrOpenNextWeeklyPlan<FileRef>(
  adapter: NoteFactoryAdapter<FileRef>,
  definition: WeeklyPlanDefinition,
  now = new Date(),
): Promise<FileRef> {
  const templateFile = adapter.getTemplateFile(definition.templatePath);

  if (!templateFile) {
    throw new Error(`Template not found: ${definition.templatePath}`);
  }

  const weekStart = getNextWeekStart(now);
  const notePath = resolveWeeklyPlanPath(weekStart, definition.folderPath, definition.title);

  if (adapter.exists(notePath)) {
    const existingFile = adapter.getFile?.(notePath);

    if (!existingFile) {
      throw new Error(`Weekly plan exists but could not be opened: ${notePath}`);
    }

    await adapter.open(existingFile);
    return existingFile;
  }

  await adapter.ensureFolder(definition.folderPath);

  const templateContents = await adapter.read(templateFile);
  const renderedContents = renderWeeklyPlanTemplate(templateContents, weekStart);
  const createdFile = await adapter.create(notePath, renderedContents);

  await adapter.open(createdFile);

  return createdFile;
}

export function getNextWeekStart(now: Date): Date {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilNextSunday = 7 - date.getDay();

  date.setDate(date.getDate() + daysUntilNextSunday);

  return date;
}

export function resolveWeeklyPlanPath(
  weekStart: Date,
  folderPath: string,
  title: string,
): string {
  const normalizedFolderPath = trimSlashes(folderPath);
  const isoDate = formatIsoDate(weekStart);
  const weekToken = formatWeekToken(weekStart);

  return joinVaultPath(normalizedFolderPath, `${isoDate} ${weekToken} — ${title}.md`);
}

export function renderWeeklyPlanTemplate(templateContents: string, weekStart: Date): string {
  return templateContents.replace(/\{\{date:YYYY-MM-DD\}\}/g, formatIsoDate(weekStart));
}

function formatWeekToken(weekStart: Date): string {
  const monday = addDays(weekStart, 1);
  const weekNumber = getIsoWeekNumber(monday);

  return `W${String(weekNumber).padStart(2, "0")}`;
}

function getIsoWeekNumber(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = utcDate.getUTCDay() || 7;

  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const daysSinceYearStart = Math.floor((utcDate.getTime() - yearStart.getTime()) / 86400000);

  return Math.ceil((daysSinceYearStart + 1) / 7);
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function joinVaultPath(...parts: string[]): string {
  return parts
    .map((part) => trimSlashes(part))
    .filter(Boolean)
    .join("/");
}
