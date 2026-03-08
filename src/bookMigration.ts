export const DEFAULT_BOOK_MIGRATION_EXCLUDES = ["Books"];

export interface PlannedBookMigration {
  basename: string;
  oldPath: string;
  oldLinkPath: string;
  newFolderPath: string;
  newPath: string;
  newLinkPath: string;
}

export interface PlannedBookMigrationResult {
  migrations: PlannedBookMigration[];
  conflicts: string[];
}

export interface RewriteLinksResult {
  content: string;
  rewriteCount: number;
  ambiguousTargets: string[];
}

const WIKI_LINK_OR_EMBED_REGEX = /(!)?\[\[([^[\]]+)\]\]/g;

export function findTopLevelFlatBookNotes(
  markdownPaths: string[],
  booksFolderPath: string,
  excludedBasenames: string[] = [],
): string[] {
  const normalizedBooksFolderPath = trimSlashes(booksFolderPath);
  const excludedBasenameSet = new Set(excludedBasenames.map((value) => value.toLowerCase()));

  return [...markdownPaths]
    .map((path) => trimSlashes(path))
    .filter((path) => {
      if (!path.startsWith(`${normalizedBooksFolderPath}/`) || !path.toLowerCase().endsWith(".md")) {
        return false;
      }

      const relativePath = path.slice(normalizedBooksFolderPath.length + 1);

      if (relativePath.includes("/")) {
        return false;
      }

      const basename = getBasenameWithoutExtension(path);

      return !excludedBasenameSet.has(basename.toLowerCase());
    })
    .sort((left, right) => left.localeCompare(right));
}

export function planBookMigrations(
  markdownPaths: string[],
  folderPaths: string[],
  booksFolderPath: string,
  excludedBasenames: string[] = [],
): PlannedBookMigrationResult {
  const migrations = findTopLevelFlatBookNotes(markdownPaths, booksFolderPath, excludedBasenames).map(
    (oldPath) => {
      const basename = getBasenameWithoutExtension(oldPath);
      const normalizedBooksFolderPath = trimSlashes(booksFolderPath);
      const newFolderPath = joinVaultPath(normalizedBooksFolderPath, basename);
      const newPath = joinVaultPath(newFolderPath, `${basename}.md`);

      return {
        basename,
        oldPath,
        oldLinkPath: removeMarkdownExtension(oldPath),
        newFolderPath,
        newPath,
        newLinkPath: removeMarkdownExtension(newPath),
      };
    },
  );

  const normalizedMarkdownPathSet = new Set(markdownPaths.map((path) => trimSlashes(path).toLowerCase()));
  const normalizedFolderPathSet = new Set(folderPaths.map((path) => trimSlashes(path).toLowerCase()));
  const conflicts: string[] = [];

  for (const migration of migrations) {
    const newPathLowercase = migration.newPath.toLowerCase();

    if (normalizedMarkdownPathSet.has(newPathLowercase)) {
      conflicts.push(
        `Target note already exists for ${migration.oldPath}: ${migration.newPath}`,
      );
      continue;
    }

    const existingFolderForMigration = normalizedFolderPathSet.has(migration.newFolderPath.toLowerCase());

    if (!existingFolderForMigration) {
      normalizedFolderPathSet.add(migration.newFolderPath.toLowerCase());
    }
  }

  return {
    migrations,
    conflicts,
  };
}

export function buildBasenameCounts(markdownPaths: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const path of markdownPaths) {
    const normalizedBasename = getBasenameWithoutExtension(path).toLowerCase();
    counts.set(normalizedBasename, (counts.get(normalizedBasename) ?? 0) + 1);
  }

  return counts;
}

export function rewriteWikiLinksForBookMigrations(
  content: string,
  migrations: PlannedBookMigration[],
  basenameCounts: Map<string, number>,
): RewriteLinksResult {
  const migrationsByExplicitPath = new Map<string, PlannedBookMigration>();
  const migrationsByBasename = new Map<string, PlannedBookMigration>();
  const ambiguousTargets = new Set<string>();

  for (const migration of migrations) {
    migrationsByExplicitPath.set(migration.oldLinkPath.toLowerCase(), migration);
    migrationsByBasename.set(migration.basename.toLowerCase(), migration);
  }

  let rewriteCount = 0;

  const rewrittenContent = content.replace(
    WIKI_LINK_OR_EMBED_REGEX,
    (fullMatch, embedPrefix: string | undefined, inner: string) => {
      const { alias, suffix, targetBase } = parseWikiLinkInner(inner);
      const normalizedTargetBase = removeMarkdownExtension(targetBase).toLowerCase();

      let migration = migrationsByExplicitPath.get(normalizedTargetBase);

      if (!migration && !normalizedTargetBase.includes("/")) {
        const basenameMigration = migrationsByBasename.get(normalizedTargetBase);

        if (basenameMigration) {
          const basenameCount = basenameCounts.get(normalizedTargetBase) ?? 0;

          if (basenameCount === 1) {
            migration = basenameMigration;
          } else {
            ambiguousTargets.add(targetBase);
          }
        }
      }

      if (!migration) {
        return fullMatch;
      }

      const nextInner = `${migration.newLinkPath}${suffix}${alias === null ? "" : `|${alias}`}`;

      if (nextInner === inner) {
        return fullMatch;
      }

      rewriteCount += 1;

      return `${embedPrefix ?? ""}[[${nextInner}]]`;
    },
  );

  return {
    content: rewrittenContent,
    rewriteCount,
    ambiguousTargets: [...ambiguousTargets].sort((left, right) => left.localeCompare(right)),
  };
}

function parseWikiLinkInner(inner: string): {
  alias: string | null;
  suffix: string;
  targetBase: string;
} {
  const pipeIndex = inner.indexOf("|");
  const targetWithOptionalSuffix = pipeIndex === -1 ? inner : inner.slice(0, pipeIndex);
  const alias = pipeIndex === -1 ? null : inner.slice(pipeIndex + 1);
  const suffixMatch = targetWithOptionalSuffix.match(/([#^].*)$/);
  const suffix = suffixMatch?.[1] ?? "";
  const targetBase = suffix
    ? targetWithOptionalSuffix.slice(0, targetWithOptionalSuffix.length - suffix.length)
    : targetWithOptionalSuffix;

  return {
    alias,
    suffix,
    targetBase,
  };
}

function getBasenameWithoutExtension(path: string): string {
  const normalizedPath = trimSlashes(path);
  const fileName = normalizedPath.split("/").pop() ?? normalizedPath;

  return fileName.replace(/\.md$/i, "");
}

function removeMarkdownExtension(path: string): string {
  return trimSlashes(path).replace(/\.md$/i, "");
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function joinVaultPath(...parts: string[]): string {
  return parts
    .map((part) => trimSlashes(part))
    .filter(Boolean)
    .join("/");
}
