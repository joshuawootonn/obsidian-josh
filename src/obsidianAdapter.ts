import { App, normalizePath, TFile, TFolder } from "obsidian";

import type { NoteFactoryAdapter } from "./noteFactory";

export function createObsidianAdapter(app: App): NoteFactoryAdapter<TFile> {
  return {
    getTemplateFile(templatePath) {
      const file = app.vault.getAbstractFileByPath(normalizePath(templatePath));
      return file instanceof TFile ? file : null;
    },
    read(file) {
      return app.vault.cachedRead(file);
    },
    exists(path) {
      return Boolean(app.vault.getAbstractFileByPath(normalizePath(path)));
    },
    async ensureFolder(folderPath) {
      await ensureFolderExists(app, folderPath);
    },
    create(path, contents) {
      return app.vault.create(normalizePath(path), contents);
    },
    async open(file) {
      const leaf = app.workspace.getMostRecentLeaf() ?? app.workspace.getLeaf(true);
      await leaf.openFile(file);
    },
  };
}

export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  const normalizedFolderPath = normalizePath(folderPath);

  if (!normalizedFolderPath) {
    return;
  }

  const pathSegments = normalizedFolderPath.split("/");
  let currentPath = "";

  for (const segment of pathSegments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const existingEntry = app.vault.getAbstractFileByPath(currentPath);

    if (existingEntry instanceof TFolder) {
      continue;
    }

    if (existingEntry instanceof TFile) {
      throw new Error(`Expected folder but found file at: ${currentPath}`);
    }

    await app.vault.createFolder(currentPath);
  }
}
