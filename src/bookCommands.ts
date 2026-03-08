import {
  resolveUniqueNotePath,
  type NoteFactoryAdapter,
  type NoteTypeDefinition,
} from "./noteFactory";

export interface FolderBackedNoteDefinition {
  parentFolderPath: string;
  templatePath: string;
  title: string;
  fallbackTitle: string;
}

export interface ChapterNoteDefinition {
  bookFolderPath: string;
  templatePath: string;
  title: string;
  fallbackTitle: string;
}

export interface ResolvedFolderBackedNotePaths {
  title: string;
  folderPath: string;
  notePath: string;
}

export function normalizeVaultTitle(rawTitle: string, fallbackTitle: string): string {
  const trimmedTitle = rawTitle.trim().replace(/\s+/g, " ");
  const sanitizedTitle = trimmedTitle.replace(/[\\/]+/g, " - ").trim();

  return sanitizedTitle || fallbackTitle;
}

export function resolveUniqueFolderBackedNotePaths(
  parentFolderPath: string,
  rawTitle: string,
  fallbackTitle: string,
  exists: (path: string) => boolean,
): ResolvedFolderBackedNotePaths {
  const normalizedParentFolderPath = trimSlashes(parentFolderPath);
  const baseTitle = normalizeVaultTitle(rawTitle, fallbackTitle);

  let duplicateNumber = 0;

  while (true) {
    const candidateTitle =
      duplicateNumber === 0 ? baseTitle : `${baseTitle} ${duplicateNumber}`;
    const folderPath = joinVaultPath(normalizedParentFolderPath, candidateTitle);
    const notePath = joinVaultPath(folderPath, `${candidateTitle}.md`);

    if (!exists(notePath)) {
      return {
        title: candidateTitle,
        folderPath,
        notePath,
      };
    }

    duplicateNumber += 1;
  }
}

export async function createFolderBackedNoteFromTemplate<FileRef>(
  adapter: NoteFactoryAdapter<FileRef>,
  definition: FolderBackedNoteDefinition,
): Promise<FileRef> {
  const templateFile = adapter.getTemplateFile(definition.templatePath);

  if (!templateFile) {
    throw new Error(`Template not found: ${definition.templatePath}`);
  }

  const resolvedPaths = resolveUniqueFolderBackedNotePaths(
    definition.parentFolderPath,
    definition.title,
    definition.fallbackTitle,
    (path) => adapter.exists(path),
  );

  await adapter.ensureFolder(resolvedPaths.folderPath);

  const initialContents = await adapter.read(templateFile);
  const createdFile = await adapter.create(resolvedPaths.notePath, initialContents);

  await adapter.open(createdFile);

  return createdFile;
}

export function getTopLevelFolderPaths(paths: string[], rootFolderPath: string): string[] {
  const normalizedRootFolderPath = trimSlashes(rootFolderPath);

  return [...paths]
    .map((path) => trimSlashes(path))
    .filter((path) => {
      if (!path.startsWith(`${normalizedRootFolderPath}/`)) {
        return false;
      }

      const relativePath = path.slice(normalizedRootFolderPath.length + 1);

      return relativePath.length > 0 && !relativePath.includes("/");
    })
    .sort((left, right) => left.localeCompare(right));
}

export function resolveUniqueChapterNotePath(
  bookFolderPath: string,
  rawTitle: string,
  fallbackTitle: string,
  exists: (path: string) => boolean,
): string {
  const definition: NoteTypeDefinition = {
    folderPath: bookFolderPath,
    templatePath: "",
    baseName: normalizeVaultTitle(rawTitle, fallbackTitle),
  };

  return resolveUniqueNotePath(definition, exists);
}

export async function createChapterNoteFromTemplate<FileRef>(
  adapter: NoteFactoryAdapter<FileRef>,
  definition: ChapterNoteDefinition,
): Promise<FileRef> {
  const templateFile = adapter.getTemplateFile(definition.templatePath);

  if (!templateFile) {
    throw new Error(`Template not found: ${definition.templatePath}`);
  }

  await adapter.ensureFolder(definition.bookFolderPath);

  const initialContents = await adapter.read(templateFile);
  const notePath = resolveUniqueChapterNotePath(
    definition.bookFolderPath,
    definition.title,
    definition.fallbackTitle,
    (path) => adapter.exists(path),
  );
  const createdFile = await adapter.create(notePath, initialContents);

  await adapter.open(createdFile);

  return createdFile;
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
