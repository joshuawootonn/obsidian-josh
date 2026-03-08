import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_BOOK_MIGRATION_EXCLUDES,
  buildBasenameCounts,
  planBookMigrations,
  rewriteWikiLinksForBookMigrations,
} from "../src/bookMigration";

interface CliOptions {
  vaultPath: string;
  booksFolderPath: string;
  dryRun: boolean;
  excludedBasenames: string[];
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const markdownPaths = await listMarkdownPaths(options.vaultPath);
  const folderPaths = await listFolderPaths(options.vaultPath);
  const { migrations, conflicts } = planBookMigrations(
    markdownPaths,
    folderPaths,
    options.booksFolderPath,
    options.excludedBasenames,
  );

  if (migrations.length === 0) {
    console.log("No flat book notes found to migrate.");
    return;
  }

  if (conflicts.length > 0) {
    console.error("Migration conflicts detected:");

    for (const conflict of conflicts) {
      console.error(`- ${conflict}`);
    }

    process.exitCode = 1;
    return;
  }

  const basenameCounts = buildBasenameCounts(markdownPaths);
  const fileContents = new Map<string, string>(
    await Promise.all(
      markdownPaths.map(
        async (relativePath): Promise<[string, string]> => [
          relativePath,
          await readFile(path.join(options.vaultPath, relativePath), "utf8"),
        ],
      ),
    ),
  );
  const destinationPaths = new Map(migrations.map((migration) => [migration.oldPath, migration.newPath]));
  const rewriteSummaries = markdownPaths
    .map((relativePath) => {
      const rewriteResult = rewriteWikiLinksForBookMigrations(
        fileContents.get(relativePath) ?? "",
        migrations,
        basenameCounts,
      );

      return {
        sourcePath: relativePath,
        targetPath: destinationPaths.get(relativePath) ?? relativePath,
        ...rewriteResult,
      };
    })
    .filter(
      (summary) =>
        summary.rewriteCount > 0 ||
        summary.sourcePath !== summary.targetPath ||
        summary.ambiguousTargets.length > 0,
    );

  printSummary(migrations, rewriteSummaries, options.dryRun);

  if (options.dryRun) {
    return;
  }

  for (const migration of migrations) {
    await mkdir(path.join(options.vaultPath, migration.newFolderPath), { recursive: true });
    await rename(
      path.join(options.vaultPath, migration.oldPath),
      path.join(options.vaultPath, migration.newPath),
    );
  }

  for (const summary of rewriteSummaries) {
    if (summary.rewriteCount === 0) {
      continue;
    }

    await writeFile(
      path.join(options.vaultPath, summary.targetPath),
      summary.content,
      "utf8",
    );
  }

  console.log("Book migration completed.");
}

function parseCliOptions(args: string[]): CliOptions {
  let vaultPath = "/Users/work/josh";
  let booksFolderPath = "Books";
  let dryRun = false;
  const excludedBasenames = [...DEFAULT_BOOK_MIGRATION_EXCLUDES];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (argument === "--vault") {
      vaultPath = args[index + 1] ?? vaultPath;
      index += 1;
      continue;
    }

    if (argument === "--books-folder") {
      booksFolderPath = args[index + 1] ?? booksFolderPath;
      index += 1;
      continue;
    }

    if (argument === "--exclude") {
      const excludedBasename = args[index + 1];

      if (excludedBasename) {
        excludedBasenames.push(excludedBasename);
        index += 1;
      }
    }
  }

  return {
    vaultPath,
    booksFolderPath,
    dryRun,
    excludedBasenames,
  };
}

async function listMarkdownPaths(vaultPath: string): Promise<string[]> {
  const relativePaths: string[] = [];

  await walkDirectory(vaultPath, async (absolutePath, relativePath, isDirectory) => {
    if (!isDirectory && relativePath.toLowerCase().endsWith(".md")) {
      relativePaths.push(relativePath);
    }
  });

  return relativePaths.sort((left, right) => left.localeCompare(right));
}

async function listFolderPaths(vaultPath: string): Promise<string[]> {
  const relativePaths: string[] = [];

  await walkDirectory(vaultPath, async (_absolutePath, relativePath, isDirectory) => {
    if (isDirectory && relativePath.length > 0) {
      relativePaths.push(relativePath);
    }
  });

  return relativePaths.sort((left, right) => left.localeCompare(right));
}

async function walkDirectory(
  rootPath: string,
  visitor: (absolutePath: string, relativePath: string, isDirectory: boolean) => Promise<void>,
  currentPath = rootPath,
): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join("/");

    await visitor(absolutePath, relativePath, entry.isDirectory());

    if (entry.isDirectory()) {
      await walkDirectory(rootPath, visitor, absolutePath);
    }
  }
}

function printSummary(
  migrations: Array<{ oldPath: string; newPath: string }>,
  rewriteSummaries: Array<{
    sourcePath: string;
    targetPath: string;
    rewriteCount: number;
    ambiguousTargets: string[];
  }>,
  dryRun: boolean,
): void {
  console.log(dryRun ? "Dry run only. No files will be changed." : "Applying migration.");
  console.log("");
  console.log(`Book notes to move: ${migrations.length}`);

  for (const migration of migrations) {
    console.log(`- ${migration.oldPath} -> ${migration.newPath}`);
  }

  console.log("");
  console.log(`Files with link rewrites or move metadata: ${rewriteSummaries.length}`);

  for (const summary of rewriteSummaries) {
    const moveLabel =
      summary.sourcePath === summary.targetPath
        ? summary.sourcePath
        : `${summary.sourcePath} -> ${summary.targetPath}`;
    const ambiguityLabel =
      summary.ambiguousTargets.length === 0
        ? ""
        : ` (ambiguous targets left unchanged: ${summary.ambiguousTargets.join(", ")})`;

    console.log(`- ${moveLabel}: ${summary.rewriteCount} rewrites${ambiguityLabel}`);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
