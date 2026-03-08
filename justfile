default:
  @just --list

install:
  pnpm install

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
