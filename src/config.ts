import type { NoteTypeDefinition } from "./noteFactory";

export interface PersonalCommandDefinition extends NoteTypeDefinition {
  commandId: string;
  commandName: string;
}

export const PERSONAL_COMMANDS: PersonalCommandDefinition[] = [
  {
    commandId: "new-person",
    commandName: "New Person",
    folderPath: "People",
    templatePath: "Templates/Person.md",
    baseName: "Untitled Person",
  },
  {
    commandId: "new-book",
    commandName: "New Book",
    folderPath: "Books",
    templatePath: "Templates/New book.md",
    baseName: "Untitled Book",
  },
];
