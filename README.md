# Josh Personal Plugin

Personal Obsidian commands for creating notes from the templates in your Obsidian vault.

## Commands

- `New Person` creates a note in `People/` from `Templates/Person.md`.
- `New Book` prompts for a title, creates `Books/<Title>/`, and creates `Books/<Title>/<Title>.md` from `Templates/New book.md`.
- `New Chapter` lets you pick a top-level folder in `Books/`, then creates a chapter note there from `Templates/Chapter.md`.
- `Open Home` opens the note at `Home.md` (configurable via `HOME_NOTE_PATH` in `src/config.ts`).
- `Open Latest Weekly Plan` opens the newest weekly plan note from `Log/`.
- `Open Latest Monthly Review` opens the newest note tagged `#Review---Process`.
- `Open Latest Quarterly Review` opens the newest note tagged `#Quarterly-Planning---Process`.

## Automatic Daily Notes

- When a note contains an unresolved `[[YYYY-MM-DD]]` link, the plugin automatically creates `Daily/YYYY-MM-DD.md`.
- This works well with `nldates-obsidian`, so typing something like `@today` and accepting `[[2026-03-08]]` will back that link with a real note in `Daily/`.
- If `Periodic Notes` has a daily template configured, the plugin copies that template into the new daily note. If not, it falls back to Obsidian core daily-note template settings, then finally to an empty note.

## Development

1. Run `pnpm install`.
2. Run `just setup-vault /absolute/path/to/your/vault`.
3. Run `pnpm dev` to watch and build into this repo's local plugin output.
4. In Obsidian, enable the `Josh Personal Plugin` community plugin in the target vault.

## Checks

- Run `pnpm build` for a one-off build.
- Run `pnpm test` for the `Vitest` suite.
- Run `pnpm check` to typecheck and run tests together.

## Local vs Synced Mode

- Local mode uses a symlink from `<vault>/.obsidian/plugins/josh-personal-plugin` to this repo's local output at `.obsidian/plugins/josh-personal-plugin`.
- Synced mode uses a normal plugin directory in the vault so Obsidian Sync can manage it directly.
- Plugin backup directories are stored at `<vault>/.obsidian/plugin-backups/josh-personal-plugin/` to avoid duplicate plugin-id directories in `.obsidian/plugins/`.

### Common commands

- `just setup-vault /absolute/path/to/your/vault` sets or updates the stored vault path in `.obsidian-dev.json` and switches to local mode.
- `just use-local` switches back to local mode using the cached vault path from `.obsidian-dev.json`.
- `just use-synced` restores the most recent synced backup directory using the cached vault path.
- `just plugin-status` prints the current mode and plugin path details using the cached vault path.
- `just dev` runs the local build watcher while using local mode.

## Hardcoded Paths

The initial note/template mappings live in `src/config.ts`:

- `People` + `Templates/Person.md`
- `Books` + `Templates/New book.md`
- `Books/*` + `Templates/Chapter.md`
- `Home.md`
- `Daily`
- `Log` + `Weekly Plan`
- Tags `Review---Process` + `Quarterly-Planning---Process`

Update those values there whenever you want to add more personal note types or rename paths.
