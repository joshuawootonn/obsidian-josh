import {
  App,
  FuzzySuggestModal,
  Modal,
  Notice,
  Plugin,
  TFile,
  TFolder,
  normalizePath,
} from "obsidian";

import {
  BOOKS_FOLDER,
  BOOK_TEMPLATE_PATH,
  CHAPTER_TEMPLATE_PATH,
  DAILY_NOTE_FOLDER,
  DEFAULT_BOOK_TITLE,
  DEFAULT_CHAPTER_TITLE,
  PERSONAL_COMMANDS,
  WEEKLY_PLAN_FOLDER,
  WEEKLY_PLAN_TITLE_FRAGMENT,
} from "./config";
import {
  createChapterNoteFromTemplate,
  createFolderBackedNoteFromTemplate,
  getTopLevelFolderPaths,
} from "./bookCommands";
import { ensureMissingDailyNotes } from "./dailyNoteLinks";
import { resolveDailyTemplateContents } from "./dailyNoteTemplate";
import { createNoteFromTemplate } from "./noteFactory";
import { createObsidianAdapter, ensureFolderExists } from "./obsidianAdapter";
import { findLatestWeeklyPlan } from "./weeklyPlan";

export default class JoshPersonalPlugin extends Plugin {
  private dailyNoteSyncTimer: number | null = null;

  private readonly pendingDailyNotePaths = new Set<string>();

  async onload(): Promise<void> {
    const adapter = createObsidianAdapter(this.app);

    for (const command of PERSONAL_COMMANDS) {
      this.addCommand({
        id: command.commandId,
        name: command.commandName,
        callback: async () => {
          try {
            await createNoteFromTemplate(adapter, command);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error creating note";

            console.error(`[Josh Personal Plugin] ${command.commandName} failed`, error);
            new Notice(`${command.commandName} failed: ${message}`);
          }
        },
      });
    }

    this.addCommand({
      id: "new-book",
      name: "New Book",
      callback: async () => {
        try {
          const title = await this.promptForText("New Book", "Book title");

          if (title === null) {
            return;
          }

          await createFolderBackedNoteFromTemplate(adapter, {
            parentFolderPath: BOOKS_FOLDER,
            templatePath: BOOK_TEMPLATE_PATH,
            title,
            fallbackTitle: DEFAULT_BOOK_TITLE,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error creating book";

          console.error("[Josh Personal Plugin] New Book failed", error);
          new Notice(`New Book failed: ${message}`);
        }
      },
    });

    this.addCommand({
      id: "new-chapter",
      name: "New Chapter",
      callback: async () => {
        try {
          const chapterSelection = await this.promptForChapterCreation();

          if (!chapterSelection) {
            return;
          }

          await createChapterNoteFromTemplate(adapter, {
            bookFolderPath: chapterSelection.path,
            templatePath: CHAPTER_TEMPLATE_PATH,
            title: chapterSelection.chapterTitle,
            fallbackTitle: DEFAULT_CHAPTER_TITLE,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error creating chapter";

          console.error("[Josh Personal Plugin] New Chapter failed", error);
          new Notice(`New Chapter failed: ${message}`);
        }
      },
    });

    this.addCommand({
      id: "open-latest-weekly-plan",
      name: "Open Latest Weekly Plan",
      callback: async () => {
        try {
          const latestWeeklyPlan = findLatestWeeklyPlan(
            this.app.vault.getMarkdownFiles(),
            WEEKLY_PLAN_FOLDER,
            WEEKLY_PLAN_TITLE_FRAGMENT,
          );

          if (!latestWeeklyPlan) {
            new Notice("No weekly plan note found.");
            return;
          }

          const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
          await leaf.openFile(latestWeeklyPlan);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error opening weekly plan";

          console.error("[Josh Personal Plugin] Open Latest Weekly Plan failed", error);
          new Notice(`Open Latest Weekly Plan failed: ${message}`);
        }
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor) => {
        const activeFile = this.app.workspace.getActiveFile();

        if (!(activeFile instanceof TFile) || activeFile.extension !== "md") {
          return;
        }

        if (this.dailyNoteSyncTimer !== null) {
          window.clearTimeout(this.dailyNoteSyncTimer);
        }

        const content = editor.getValue();

        this.dailyNoteSyncTimer = window.setTimeout(() => {
          void this.syncMissingDailyNotes(activeFile, content);
        }, 250);
      }),
    );
  }

  onunload(): void {
    if (this.dailyNoteSyncTimer !== null) {
      window.clearTimeout(this.dailyNoteSyncTimer);
      this.dailyNoteSyncTimer = null;
    }
  }

  private async syncMissingDailyNotes(file: TFile, content: string): Promise<void> {
    try {
      await ensureMissingDailyNotes({
        content,
        dailyFolder: DAILY_NOTE_FOLDER,
        adapter: {
          resolveLink: (linkText) =>
            Boolean(this.app.metadataCache.getFirstLinkpathDest(linkText, file.path)),
          exists: (path) => Boolean(this.app.vault.getAbstractFileByPath(normalizePath(path))),
          ensureFolder: (path) => ensureFolderExists(this.app, path),
          getInitialContents: () => this.getDailyNoteInitialContents(),
          create: async (path, initialContents) => {
            await this.app.vault.create(normalizePath(path), initialContents);
          },
        },
        pendingPaths: this.pendingDailyNotePaths,
      });
    } catch (error) {
      console.error("[Josh Personal Plugin] Daily note sync failed", error);
    }
  }

  private async getDailyNoteInitialContents(): Promise<string> {
    return resolveDailyTemplateContents(this.app.vault.configDir, {
      readConfig: (path) => this.app.vault.adapter.read(normalizePath(path)),
      readTemplate: async (path) => {
        const file = this.app.vault.getAbstractFileByPath(normalizePath(path));

        if (!(file instanceof TFile)) {
          return null;
        }

        return this.app.vault.cachedRead(file);
      },
    });
  }

  private async promptForChapterCreation(): Promise<ChapterCreationSelection | null> {
    const bookFolders = this.getTopLevelBookFolders();

    if (bookFolders.length === 0) {
      new Notice("No folder-based books found in Books.");
      return null;
    }

    const bookFolder = await new BookFolderSuggestModal(this.app, bookFolders).waitForSelection();

    if (!bookFolder) {
      return null;
    }

    await waitForModalTransition();

    const chapterTitle = await this.promptForText("New Chapter", `Chapter title for ${bookFolder.name}`);

    if (chapterTitle === null) {
      return null;
    }

    return {
      path: bookFolder.path,
      chapterTitle,
    };
  }

  private async promptForText(title: string, placeholder: string): Promise<string | null> {
    await waitForNextUiTurn();
    return new TextInputModal(this.app, title, placeholder).waitForValue();
  }

  private getTopLevelBookFolders(): TFolder[] {
    const allFolderPaths = this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder)
      .map((folder) => folder.path);
    const topLevelFolderPathSet = new Set(
      getTopLevelFolderPaths(allFolderPaths, BOOKS_FOLDER),
    );

    return this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder)
      .filter((folder) => topLevelFolderPathSet.has(folder.path))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}

class TextInputModal extends Modal {
  private resolveValue: ((value: string | null) => void) | null = null;

  private submitted = false;

  constructor(
    app: App,
    private readonly titleText: string,
    private readonly placeholder: string,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;

    titleEl.setText(this.titleText);
    contentEl.empty();

    const formEl = contentEl.createEl("form");
    const inputEl = formEl.createEl("input", {
      type: "text",
      placeholder: this.placeholder,
    });
    inputEl.addClass("prompt-input");

    const buttonRowEl = formEl.createDiv({ cls: "modal-button-container" });
    const submitButtonEl = buttonRowEl.createEl("button", {
      text: "Create",
      type: "submit",
    });
    submitButtonEl.addClass("mod-cta");

    formEl.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submitted = true;
      this.resolveValue?.(inputEl.value);
      this.resolveValue = null;
      this.close();
    });

    window.setTimeout(() => inputEl.focus(), 0);
  }

  waitForValue(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolveValue = resolve;
      this.open();
    });
  }

  onClose(): void {
    super.onClose();

    if (!this.submitted && this.resolveValue) {
      this.resolveValue(null);
    }

    this.resolveValue = null;
    this.submitted = false;
    this.contentEl.empty();
  }
}

interface ChapterCreationSelection {
  path: string;
  chapterTitle: string;
}

class BookFolderSuggestModal extends FuzzySuggestModal<TFolder> {
  private resolveSelection: ((folder: TFolder | null) => void) | null = null;

  private selectedFolder: TFolder | null = null;

  private hasClosed = false;

  private resolveTimer: number | null = null;

  constructor(
    app: App,
    private readonly bookFolders: TFolder[],
  ) {
    super(app);
    this.setPlaceholder("Select a book folder");
  }

  getItems(): TFolder[] {
    return this.bookFolders;
  }

  getItemText(item: TFolder): string {
    return item.name;
  }

  onChooseItem(item: TFolder): void {
    this.selectedFolder = item;
    this.scheduleResolve();
  }

  waitForSelection(): Promise<TFolder | null> {
    return new Promise((resolve) => {
      this.resolveSelection = resolve;
      this.open();
    });
  }

  onClose(): void {
    super.onClose();

    this.hasClosed = true;
    this.scheduleResolve();
  }

  private scheduleResolve(): void {
    if (!this.hasClosed || this.resolveSelection === null || this.resolveTimer !== null) {
      return;
    }

    // Obsidian can call onClose before onChooseItem, so defer resolution one tick.
    this.resolveTimer = window.setTimeout(() => {
      this.resolveTimer = null;

      if (this.resolveSelection === null) {
        return;
      }

      const resolve = this.resolveSelection;
      this.resolveSelection = null;
      resolve(this.selectedFolder);
      this.selectedFolder = null;
    }, 0);
  }
}

function waitForNextUiTurn(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

async function waitForModalTransition(): Promise<void> {
  await waitForNextUiTurn();
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}
