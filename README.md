# Josh Personal Plugin

Personal Obsidian commands for creating notes from the templates in your Obsidian vault.

## Commands

- `New Person` creates a note in `People/` from `Templates/Person.md`.
- `New Book` prompts for a title, creates `Books/<Title>/`, and creates `Books/<Title>/<Title>.md` from `Templates/New book.md`.
- `New Chapter` lets you pick a top-level folder in `Books/`, then creates a chapter note there from `Templates/Chapter.md`.
- `Open Latest Weekly Plan` opens the newest weekly plan note from `Log/`.

## Automatic Daily Notes

- When a note contains an unresolved `[[YYYY-MM-DD]]` link, the plugin automatically creates `Daily/YYYY-MM-DD.md`.
- This works well with `nldates-obsidian`, so typing something like `@today` and accepting `[[2026-03-08]]` will back that link with a real note in `Daily/`.
- If `Periodic Notes` has a daily template configured, the plugin copies that template into the new daily note. If not, it falls back to Obsidian core daily-note template settings, then finally to an empty note.

## Development

1. Run `pnpm install`.
2. Run `pnpm setup:vault -- /absolute/path/to/your/vault`.
3. Run `pnpm dev` to watch and build into this repo's local plugin output.
4. In Obsidian, enable the `Josh Personal Plugin` community plugin in the target vault.

## Checks

- Run `pnpm build` for a one-off build.
- Run `pnpm test` for the `Vitest` suite.
- Run `pnpm check` to typecheck and run tests together.

## Local Vault Setup

- `pnpm setup:vault -- /absolute/path/to/your/vault` stores the vault path in `.obsidian-dev.json`.
- The setup command creates a symlink from `<vault>/.obsidian/plugins/josh-personal-plugin` to this repo's local build output at `.obsidian/plugins/josh-personal-plugin`.
- If you run `pnpm setup:vault` with no path later, it reuses the saved vault path.
- If the target plugin path already exists as a real directory, the setup command renames it to a timestamped backup and then creates the symlink.

## Hardcoded Paths

The initial note/template mappings live in `src/config.ts`:

- `People` + `Templates/Person.md`
- `Books` + `Templates/New book.md`
- `Books/*` + `Templates/Chapter.md`
- `Daily`
- `Log` + `Weekly Plan`

Update those values there whenever you want to add more personal note types or rename paths.
