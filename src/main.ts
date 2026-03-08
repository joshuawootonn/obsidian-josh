import { Notice, Plugin, TFile, normalizePath } from "obsidian";

import { DAILY_NOTE_FOLDER, PERSONAL_COMMANDS } from "./config";
import { ensureMissingDailyNotes } from "./dailyNoteLinks";
import { resolveDailyTemplateContents } from "./dailyNoteTemplate";
import { createNoteFromTemplate } from "./noteFactory";
import { createObsidianAdapter, ensureFolderExists } from "./obsidianAdapter";

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
}
