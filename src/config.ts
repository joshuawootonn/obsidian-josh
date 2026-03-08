import type { NoteTypeDefinition } from "./noteFactory";

export interface PersonalCommandDefinition extends NoteTypeDefinition {
  commandId: string;
  commandName: string;
}

export const DAILY_NOTE_FOLDER = "Daily";
export const WEEKLY_PLAN_FOLDER = "Log";
export const WEEKLY_PLAN_TITLE_FRAGMENT = "Weekly Plan";
export const BOOKS_FOLDER = "Books";
export const BOOK_TEMPLATE_PATH = "Templates/New book.md";
export const CHAPTER_TEMPLATE_PATH = "Templates/Chapter.md";
export const DEFAULT_BOOK_TITLE = "Untitled Book";
export const DEFAULT_CHAPTER_TITLE = "Untitled Chapter";

export const PERSONAL_COMMANDS: PersonalCommandDefinition[] = [
  {
    commandId: "new-person",
    commandName: "New Person",
    folderPath: "People",
    templatePath: "Templates/Person.md",
    baseName: "Untitled Person",
  },
];
