import { Notice, Plugin } from "obsidian";

import { PERSONAL_COMMANDS } from "./config";
import { createNoteFromTemplate } from "./noteFactory";
import { createObsidianAdapter } from "./obsidianAdapter";

export default class JoshPersonalPlugin extends Plugin {
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
  }
}
