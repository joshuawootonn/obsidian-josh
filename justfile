default:
  just --list

install:
  pnpm install

setup-vault vault_path="":
  if [ -n "{{vault_path}}" ]; then pnpm run setup:vault -- "{{vault_path}}"; else pnpm run setup:vault; fi

plugin-status:
  pnpm run plugin:status

use-local:
  pnpm run plugin:use-local

use-synced:
  pnpm run plugin:use-synced

dev:
  pnpm dev

build:
  pnpm build

test:
  pnpm test

test-watch:
  pnpm test:watch

check:
  pnpm check
