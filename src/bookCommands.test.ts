import { describe, expect, it, vi } from "vitest";

import {
  createChapterNoteFromTemplate,
  createFolderBackedNoteFromTemplate,
  getTopLevelFolderPaths,
  normalizeVaultTitle,
  resolveUniqueFolderBackedNotePaths,
  type ChapterNoteDefinition,
  type FolderBackedNoteDefinition,
} from "./bookCommands";
import type { NoteFactoryAdapter } from "./noteFactory";

interface FakeFile {
  path: string;
  contents?: string;
}

describe("normalizeVaultTitle", () => {
  it("trims whitespace and replaces path separators", () => {
    expect(normalizeVaultTitle("  The / Rust \\\\ Book  ", "Fallback")).toBe(
      "The  -  Rust  -  Book",
    );
  });

  it("falls back when the title is blank", () => {
    expect(normalizeVaultTitle("   ", "Untitled Book")).toBe("Untitled Book");
  });
});

describe("resolveUniqueFolderBackedNotePaths", () => {
  it("creates a self-titled note inside a book folder", () => {
    const paths = resolveUniqueFolderBackedNotePaths("Books", "Deep Work", "Untitled Book", () => false);

    expect(paths).toEqual({
      title: "Deep Work",
      folderPath: "Books/Deep Work",
      notePath: "Books/Deep Work/Deep Work.md",
    });
  });

  it("adds duplicate numbering when the root note already exists", () => {
    const existingPaths = new Set(["Books/Deep Work/Deep Work.md"]);

    const paths = resolveUniqueFolderBackedNotePaths(
      "Books",
      "Deep Work",
      "Untitled Book",
      (candidatePath) => existingPaths.has(candidatePath),
    );

    expect(paths).toEqual({
      title: "Deep Work 1",
      folderPath: "Books/Deep Work 1",
      notePath: "Books/Deep Work 1/Deep Work 1.md",
    });
  });
});

describe("createFolderBackedNoteFromTemplate", () => {
  it("creates and opens a self-titled note in a book folder", async () => {
    const templateFile: FakeFile = {
      path: "Templates/New book.md",
      contents: "# Chapters Notes\n",
    };
    const createdFile: FakeFile = { path: "Books/Deep Work/Deep Work.md" };
    const definition: FolderBackedNoteDefinition = {
      parentFolderPath: "Books",
      templatePath: "Templates/New book.md",
      title: "Deep Work",
      fallbackTitle: "Untitled Book",
    };
    const adapter: NoteFactoryAdapter<FakeFile> = {
      getTemplateFile: vi.fn((path: string) => (path === templateFile.path ? templateFile : null)),
      read: vi.fn(async (file: FakeFile) => file.contents ?? ""),
      exists: vi.fn(() => false),
      ensureFolder: vi.fn(async () => undefined),
      create: vi.fn(async () => createdFile),
      open: vi.fn(async () => undefined),
    };

    const result = await createFolderBackedNoteFromTemplate(adapter, definition);

    expect(result).toBe(createdFile);
    expect(adapter.ensureFolder).toHaveBeenCalledWith("Books/Deep Work");
    expect(adapter.create).toHaveBeenCalledWith("Books/Deep Work/Deep Work.md", "# Chapters Notes\n");
    expect(adapter.open).toHaveBeenCalledWith(createdFile);
  });
});

describe("getTopLevelFolderPaths", () => {
  it("returns only direct child folders under Books", () => {
    expect(
      getTopLevelFolderPaths(
        ["Books/Deep Work", "Books/Psalms", "Books/Psalms/Chapters", "People/Josh"],
        "Books",
      ),
    ).toEqual(["Books/Deep Work", "Books/Psalms"]);
  });
});

describe("createChapterNoteFromTemplate", () => {
  it("creates a chapter note in the selected book folder", async () => {
    const templateFile: FakeFile = {
      path: "Templates/Chapter.md",
      contents: "---\nChapter:\n",
    };
    const createdFile: FakeFile = { path: "Books/Deep Work/Chapter 1.md" };
    const definition: ChapterNoteDefinition = {
      bookFolderPath: "Books/Deep Work",
      templatePath: "Templates/Chapter.md",
      title: "Chapter 1",
      fallbackTitle: "Untitled Chapter",
    };
    const adapter: NoteFactoryAdapter<FakeFile> = {
      getTemplateFile: vi.fn((path: string) => (path === templateFile.path ? templateFile : null)),
      read: vi.fn(async (file: FakeFile) => file.contents ?? ""),
      exists: vi.fn(() => false),
      ensureFolder: vi.fn(async () => undefined),
      create: vi.fn(async () => createdFile),
      open: vi.fn(async () => undefined),
    };

    const result = await createChapterNoteFromTemplate(adapter, definition);

    expect(result).toBe(createdFile);
    expect(adapter.ensureFolder).toHaveBeenCalledWith("Books/Deep Work");
    expect(adapter.create).toHaveBeenCalledWith("Books/Deep Work/Chapter 1.md", "---\nChapter:\n");
    expect(adapter.open).toHaveBeenCalledWith(createdFile);
  });
});
