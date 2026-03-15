import type { NoteFactoryAdapter } from "./noteFactory";

export interface MonthlyReviewDefinition {
  folderPath: string;
  templatePath: string;
}

export async function createOrOpenNextMonthlyReview<FileRef>(
  adapter: NoteFactoryAdapter<FileRef>,
  definition: MonthlyReviewDefinition,
  now = new Date(),
): Promise<FileRef> {
  const templateFile = adapter.getTemplateFile(definition.templatePath);

  if (!templateFile) {
    throw new Error(`Template not found: ${definition.templatePath}`);
  }

  const reviewDate = getNextMonthlyReviewDate(now);
  const notePath = resolveMonthlyReviewPath(reviewDate, definition.folderPath);

  if (adapter.exists(notePath)) {
    const existingFile = adapter.getFile?.(notePath);

    if (!existingFile) {
      throw new Error(`Monthly review exists but could not be opened: ${notePath}`);
    }

    await adapter.open(existingFile);
    return existingFile;
  }

  await adapter.ensureFolder(definition.folderPath);

  const templateContents = await adapter.read(templateFile);
  const renderedContents = renderMonthlyReviewTemplate(templateContents, reviewDate);
  const createdFile = await adapter.create(notePath, renderedContents);

  await adapter.open(createdFile);

  return createdFile;
}

export function getNextMonthlyReviewDate(now: Date): Date {
  return getFirstDayOfNextMonth(now);
}

export function resolveMonthlyReviewPath(
  reviewDate: Date,
  folderPath: string,
): string {
  const normalizedFolderPath = trimSlashes(folderPath);
  const noteTitle = formatMonthYear(reviewDate);

  return joinVaultPath(normalizedFolderPath, `${noteTitle}.md`);
}

export function renderMonthlyReviewTemplate(templateContents: string, reviewDate: Date): string {
  return templateContents.replace(/\{\{date:YYYY-MM-DD\}\}/g, formatIsoDate(reviewDate));
}

function getFirstDayOfNextMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
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
