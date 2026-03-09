default:
  @just --list

install:
  pnpm install

setup-vault vault_path="":
  if [ -n "{{vault_path}}" ]; then pnpm run setup:vault -- "{{vault_path}}"; else pnpm run setup:vault; fi

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
