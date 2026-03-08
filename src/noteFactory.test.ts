import { describe, expect, it, vi } from "vitest";

import {
  createNoteFromTemplate,
  resolveUniqueNotePath,
  type NoteFactoryAdapter,
  type NoteTypeDefinition,
} from "./noteFactory";

interface FakeFile {
  path: string;
  contents?: string;
}

describe("resolveUniqueNotePath", () => {
  it("uses the base name for the first available note", () => {
    const path = resolveUniqueNotePath(
      {
        folderPath: "People",
        templatePath: "Templates/Person.md",
        baseName: "Untitled Person",
      },
      () => false,
    );

    expect(path).toBe("People/Untitled Person.md");
  });

  it("increments the file name when duplicates exist", () => {
    const existingPaths = new Set([
      "Books/Untitled Book.md",
      "Books/Untitled Book 1.md",
    ]);

    const path = resolveUniqueNotePath(
      {
        folderPath: "Books",
        templatePath: "Templates/New book.md",
        baseName: "Untitled Book",
      },
      (candidatePath) => existingPaths.has(candidatePath),
    );

    expect(path).toBe("Books/Untitled Book 2.md");
  });
});

describe("createNoteFromTemplate", () => {
  it("creates and opens a note from the template contents", async () => {
    const templateFile: FakeFile = {
      path: "Templates/Person.md",
      contents: "---\nSource:\n  - \"[[TTW]]\"\n---\n",
    };
    const createdFile: FakeFile = { path: "People/Untitled Person.md" };
    const definition: NoteTypeDefinition = {
      folderPath: "People",
      templatePath: "Templates/Person.md",
      baseName: "Untitled Person",
    };

    const adapter: NoteFactoryAdapter<FakeFile> = {
      getTemplateFile: vi.fn((path: string) => (path === templateFile.path ? templateFile : null)),
      read: vi.fn(async (file: FakeFile) => file.contents ?? ""),
      exists: vi.fn(() => false),
      ensureFolder: vi.fn(async () => undefined),
      create: vi.fn(async () => createdFile),
      open: vi.fn(async () => undefined),
    };

    const result = await createNoteFromTemplate(adapter, definition);

    expect(result).toBe(createdFile);
    expect(adapter.ensureFolder).toHaveBeenCalledWith("People");
    expect(adapter.create).toHaveBeenCalledWith(
      "People/Untitled Person.md",
      templateFile.contents,
    );
    expect(adapter.open).toHaveBeenCalledWith(createdFile);
  });

  it("throws when the template file does not exist", async () => {
    const adapter: NoteFactoryAdapter<FakeFile> = {
      getTemplateFile: vi.fn(() => null),
      read: vi.fn(),
      exists: vi.fn(() => false),
      ensureFolder: vi.fn(async () => undefined),
      create: vi.fn(),
      open: vi.fn(async () => undefined),
    };

    await expect(
      createNoteFromTemplate(adapter, {
        folderPath: "Books",
        templatePath: "Templates/Missing.md",
        baseName: "Untitled Book",
      }),
    ).rejects.toThrow("Template not found: Templates/Missing.md");
  });
});
