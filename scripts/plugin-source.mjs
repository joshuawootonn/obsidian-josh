import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const configPath = path.join(repoRoot, ".obsidian-dev.json");
const manifestPath = path.join(repoRoot, "manifest.json");

const VALID_COMMANDS = new Set(["status", "use-local", "use-synced"]);

async function main() {
  const { command, requestedVaultPath } = parseCliArguments(process.argv.slice(2));
  const pluginId = await readPluginId();
  const localPluginPath = path.join(repoRoot, ".obsidian", "plugins", pluginId);
  const savedConfig = await readSavedConfig();
  const vaultPathInput = requestedVaultPath ?? savedConfig?.vaultPath;

  if (!vaultPathInput) {
    throw new Error("Vault path is not configured. Run `pnpm setup:vault -- /absolute/path/to/your/vault`.");
  }

  const vaultPath = path.resolve(vaultPathInput);
  const paths = getVaultPaths(vaultPath, pluginId, localPluginPath);

  if (command === "status") {
    await printStatus(paths);
    return;
  }

  await ensureDirectoryExists(paths.vaultPath, "Vault path");
  await ensureDirectoryExists(paths.vaultConfigDirectory, "Vault .obsidian directory");
  await fs.mkdir(paths.vaultPluginsDirectory, { recursive: true });
  await fs.mkdir(path.dirname(paths.localPluginPath), { recursive: true });
  await fs.mkdir(paths.backupRootDirectory, { recursive: true });

  if (command === "use-local") {
    await switchToLocal(paths);
    await writeConfig(paths, "local");
    return;
  }

  await switchToSynced(paths);
  await writeConfig(paths, "synced");
}

function parseCliArguments(args) {
  const [command, ...rest] = args.filter((argument) => argument !== "--");

  if (!VALID_COMMANDS.has(command)) {
    throw new Error(
      [
        "Usage:",
        "  node scripts/plugin-source.mjs status [--vault /absolute/path/to/vault]",
        "  node scripts/plugin-source.mjs use-local [--vault /absolute/path/to/vault]",
        "  node scripts/plugin-source.mjs use-synced [--vault /absolute/path/to/vault]",
      ].join("\n"),
    );
  }

  let requestedVaultPath = null;

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];

    if (argument === "--vault") {
      const nextArgument = rest[index + 1];

      if (!nextArgument) {
        throw new Error("Missing value for --vault.");
      }

      requestedVaultPath = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (requestedVaultPath === null) {
      requestedVaultPath = argument;
      continue;
    }

    throw new Error(`Unexpected argument: ${argument}`);
  }

  return {
    command,
    requestedVaultPath,
  };
}

async function readPluginId() {
  const rawManifest = await fs.readFile(manifestPath, "utf8");
  const parsedManifest = JSON.parse(rawManifest);

  if (!parsedManifest?.id || typeof parsedManifest.id !== "string") {
    throw new Error(`Invalid manifest id in ${manifestPath}`);
  }

  return parsedManifest.id;
}

function getVaultPaths(vaultPath, pluginId, localPluginPath) {
  const vaultConfigDirectory = path.join(vaultPath, ".obsidian");
  const vaultPluginsDirectory = path.join(vaultConfigDirectory, "plugins");
  const pluginPathInVault = path.join(vaultPluginsDirectory, pluginId);
  const pluginBackupsDirectory = path.join(vaultConfigDirectory, "plugin-backups");
  const backupRootDirectory = path.join(vaultConfigDirectory, "plugin-backups", pluginId);

  return {
    vaultPath,
    pluginId,
    localPluginPath,
    vaultConfigDirectory,
    vaultPluginsDirectory,
    pluginPathInVault,
    pluginBackupsDirectory,
    backupRootDirectory,
  };
}

async function switchToLocal(paths) {
  const existing = await getPathInfo(paths.pluginPathInVault);
  const resolvedLocalTarget = path.resolve(paths.localPluginPath);

  if (existing.type === "symlink") {
    if (existing.resolvedTargetPath === resolvedLocalTarget) {
      console.log(`Already using local source: ${paths.pluginPathInVault} -> ${paths.localPluginPath}`);
      console.log("No change needed.");
      return;
    }

    await fs.unlink(paths.pluginPathInVault);
    console.log(`Removed old symlink: ${paths.pluginPathInVault}`);
  } else if (existing.type !== "missing") {
    const backupPath = await movePathToBackup(paths.pluginPathInVault, paths.backupRootDirectory, "synced");
    console.log(`Moved existing plugin folder to backup: ${backupPath}`);
  }

  const relativeTarget = path.relative(path.dirname(paths.pluginPathInVault), paths.localPluginPath);
  await fs.symlink(relativeTarget, paths.pluginPathInVault, "dir");
  console.log(`Linked local source: ${paths.pluginPathInVault} -> ${paths.localPluginPath}`);
}

async function switchToSynced(paths) {
  const existing = await getPathInfo(paths.pluginPathInVault);

  if (existing.type === "symlink") {
    await fs.unlink(paths.pluginPathInVault);
    console.log(`Removed local symlink: ${paths.pluginPathInVault}`);
  } else if (existing.type === "directory") {
    console.log(`Already using synced directory: ${paths.pluginPathInVault}`);
    return;
  } else if (existing.type === "file") {
    throw new Error(`Expected plugin path to be a directory or symlink: ${paths.pluginPathInVault}`);
  }

  const backupPath = await getMostRecentBackupPath(
    paths.backupRootDirectory,
    paths.pluginBackupsDirectory,
    paths.pluginId,
  );

  if (!backupPath) {
    console.log("No synced backup found to restore.");
    console.log(`Place the synced plugin directory at ${paths.pluginPathInVault} (or let Obsidian Sync restore it).`);
    return;
  }

  await fs.rename(backupPath, paths.pluginPathInVault);
  console.log(`Restored synced plugin from backup: ${backupPath}`);
}

async function printStatus(paths) {
  const existing = await getPathInfo(paths.pluginPathInVault);
  const pluginBackupsInPluginsDir = await listPluginBackupsInPluginsDir(
    paths.vaultPluginsDirectory,
    paths.pluginId,
  );
  const storedBackups = await listBackupEntries(paths.backupRootDirectory);
  const legacyBackups = await listLegacyBackupEntries(paths.pluginBackupsDirectory, paths.pluginId);

  console.log(`Plugin ID: ${paths.pluginId}`);
  console.log(`Vault: ${paths.vaultPath}`);
  console.log(`Vault plugin path: ${paths.pluginPathInVault}`);
  console.log(`Local plugin path: ${paths.localPluginPath}`);

  if (existing.type === "symlink") {
    const mode = existing.resolvedTargetPath === path.resolve(paths.localPluginPath) ? "local" : "linked-other";
    console.log(`Mode: ${mode}`);
    console.log(`Symlink target: ${existing.rawTargetPath ?? "(unknown)"}`);
  } else if (existing.type === "directory") {
    console.log("Mode: synced");
  } else if (existing.type === "file") {
    console.log("Mode: invalid-file");
  } else {
    console.log("Mode: missing");
  }

  console.log(`Backups in .obsidian/plugin-backups/${paths.pluginId}: ${storedBackups.length}`);
  console.log(`Legacy backups in .obsidian/plugin-backups: ${legacyBackups.length}`);

  if (pluginBackupsInPluginsDir.length > 0) {
    console.log("Warning: backup folders found inside .obsidian/plugins:");

    for (const backupPath of pluginBackupsInPluginsDir) {
      console.log(`- ${backupPath}`);
    }
  }
}

async function readSavedConfig() {
  try {
    const contents = await fs.readFile(configPath, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

async function writeConfig(paths, mode) {
  const contents = JSON.stringify(
    {
      vaultPath: paths.vaultPath,
      pluginId: paths.pluginId,
      localPluginPath: paths.localPluginPath,
      mode,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  await fs.writeFile(configPath, `${contents}\n`, "utf8");
  console.log(`Saved vault config: ${path.relative(repoRoot, configPath) || path.basename(configPath)}`);
}

async function ensureDirectoryExists(directoryPath, label) {
  let stats;

  try {
    stats = await fs.stat(directoryPath);
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(`${label} does not exist: ${directoryPath}`);
    }

    throw error;
  }

  if (!stats.isDirectory()) {
    throw new Error(`${label} is not a directory: ${directoryPath}`);
  }
}

async function getPathInfo(targetPath) {
  try {
    const stats = await fs.lstat(targetPath);

    if (stats.isSymbolicLink()) {
      const rawTargetPath = await fs.readlink(targetPath);
      const resolvedTargetPath = path.resolve(path.dirname(targetPath), rawTargetPath);

      return {
        type: "symlink",
        rawTargetPath,
        resolvedTargetPath,
      };
    }

    if (stats.isDirectory()) {
      return { type: "directory" };
    }

    return { type: "file" };
  } catch (error) {
    if (isMissingFileError(error)) {
      return { type: "missing" };
    }

    throw error;
  }
}

async function movePathToBackup(sourcePath, backupRootDirectory, prefix) {
  await fs.mkdir(backupRootDirectory, { recursive: true });
  const backupPath = await getAvailableBackupPath(backupRootDirectory, prefix);
  await fs.rename(sourcePath, backupPath);
  return backupPath;
}

async function getMostRecentBackupPath(backupRootDirectory, pluginBackupsDirectory, pluginId) {
  const nestedBackups = (await listBackupEntries(backupRootDirectory)).map((entryName) =>
    path.join(backupRootDirectory, entryName),
  );
  const legacyBackups = (await listLegacyBackupEntries(pluginBackupsDirectory, pluginId)).map(
    (entryName) => path.join(pluginBackupsDirectory, entryName),
  );
  const allBackupPaths = [...nestedBackups, ...legacyBackups];

  if (allBackupPaths.length === 0) {
    return null;
  }

  const withStats = await Promise.all(
    allBackupPaths.map(async (absolutePath) => {
      const stats = await fs.stat(absolutePath);
      return { absolutePath, mtimeMs: stats.mtimeMs };
    }),
  );

  const newest = withStats.sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
  return newest?.absolutePath ?? null;
}

async function listBackupEntries(backupRootDirectory) {
  try {
    const entries = await fs.readdir(backupRootDirectory);
    return entries.sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function listLegacyBackupEntries(pluginBackupsDirectory, pluginId) {
  try {
    const entries = await fs.readdir(pluginBackupsDirectory);
    return entries
      .filter((entryName) => entryName.startsWith(`${pluginId}.backup-`))
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function listPluginBackupsInPluginsDir(pluginsDirectory, pluginId) {
  try {
    const entries = await fs.readdir(pluginsDirectory);
    return entries
      .filter((entryName) => entryName.startsWith(`${pluginId}.backup-`))
      .map((entryName) => path.join(pluginsDirectory, entryName));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function getAvailableBackupPath(backupRootDirectory, prefix) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const baseName = `${prefix}-${timestamp}`;
  let candidate = path.join(backupRootDirectory, baseName);
  let suffix = 1;

  for (;;) {
    try {
      await fs.lstat(candidate);
      candidate = path.join(backupRootDirectory, `${baseName}-${suffix}`);
      suffix += 1;
    } catch (error) {
      if (isMissingFileError(error)) {
        return candidate;
      }

      throw error;
    }
  }
}

function isMissingFileError(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Plugin source workflow failed: ${message}`);
  process.exitCode = 1;
});
