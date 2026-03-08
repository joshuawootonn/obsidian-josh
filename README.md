# Josh Personal Plugin

Personal Obsidian commands for creating notes from the templates already in `/Users/work/josh`.

## Commands

- `New Person` creates a note in `People/` from `Templates/Person.md`.
- `New Book` creates a note in `Books/` from `Templates/New book.md`.

## Development

1. Run `pnpm install`.
2. Run `pnpm dev` to watch and build directly into `/Users/work/josh/.obsidian/plugins/josh-personal-plugin`.
3. In Obsidian, enable the `Josh Personal Plugin` community plugin in the target vault.

## Checks

- Run `pnpm build` for a one-off build.
- Run `pnpm test` for the `Vitest` suite.
- Run `pnpm check` to typecheck and run tests together.

## Hardcoded Paths

The initial note/template mappings live in `src/config.ts`:

- `People` + `Templates/Person.md`
- `Books` + `Templates/New book.md`

Update those values there whenever you want to add more personal note types or rename paths.
