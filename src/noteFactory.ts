export const DEFAULT_NOTE_EXTENSION = ".md";

export interface NoteTypeDefinition {
  folderPath: string;
  templatePath: string;
  baseName: string;
  extension?: string;
}

export interface NoteFactoryAdapter<FileRef> {
  getTemplateFile(path: string): FileRef | null;
  getFile?(path: string): FileRef | null;
  read(file: FileRef): Promise<string>;
  exists(path: string): boolean;
  ensureFolder(path: string): Promise<void>;
  create(path: string, contents: string): Promise<FileRef>;
  open(file: FileRef): Promise<void>;
}

export function resolveUniqueNotePath(
  definition: NoteTypeDefinition,
  exists: (path: string) => boolean,
): string {
  const folderPath = trimSlashes(definition.folderPath);
  const baseName = definition.baseName.trim() || "Untitled";
  const extension = normalizeExtension(definition.extension);

  let duplicateNumber = 0;

  while (true) {
    const suffixedBaseName =
      duplicateNumber === 0 ? baseName : `${baseName} ${duplicateNumber}`;
    const candidatePath = joinVaultPath(folderPath, `${suffixedBaseName}${extension}`);

    if (!exists(candidatePath)) {
      return candidatePath;
    }

    duplicateNumber += 1;
  }
}

export async function createNoteFromTemplate<FileRef>(
  adapter: NoteFactoryAdapter<FileRef>,
  definition: NoteTypeDefinition,
): Promise<FileRef> {
  const templateFile = adapter.getTemplateFile(definition.templatePath);

  if (!templateFile) {
    throw new Error(`Template not found: ${definition.templatePath}`);
  }

  await adapter.ensureFolder(definition.folderPath);

  const initialContents = await adapter.read(templateFile);
  const notePath = resolveUniqueNotePath(definition, (path) => adapter.exists(path));
  const createdFile = await adapter.create(notePath, initialContents);

  await adapter.open(createdFile);

  return createdFile;
}

function normalizeExtension(extension = DEFAULT_NOTE_EXTENSION): string {
  return extension.startsWith(".") ? extension : `.${extension}`;
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
