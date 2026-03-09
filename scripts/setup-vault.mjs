import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginId = "josh-personal-plugin";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const configPath = path.join(repoRoot, ".obsidian-dev.json");
const localPluginPath = path.join(repoRoot, ".obsidian", "plugins", pluginId);

async function main() {
  const args = process.argv.slice(2).filter((argument) => argument !== "--");
  const requestedVaultPath = args[0];
  const savedConfig = await readSavedConfig();
  const vaultPathInput = requestedVaultPath ?? savedConfig?.vaultPath;

  if (!vaultPathInput) {
    throw new Error("Usage: pnpm setup:vault -- /absolute/path/to/your/vault");
  }

  const vaultPath = path.resolve(vaultPathInput);
  const vaultConfigDirectory = path.join(vaultPath, ".obsidian");
  const vaultPluginsDirectory = path.join(vaultConfigDirectory, "plugins");
  const linkedPluginPath = path.join(vaultPluginsDirectory, pluginId);

  await ensureDirectoryExists(vaultPath, "Vault path");
  await ensureDirectoryExists(vaultConfigDirectory, "Vault .obsidian directory");
  await fs.mkdir(vaultPluginsDirectory, { recursive: true });
  await fs.mkdir(path.dirname(localPluginPath), { recursive: true });

  await writeConfig(vaultPath);
  await ensureSymlink(linkedPluginPath, localPluginPath);

  console.log(`Saved vault path to ${path.relative(repoRoot, configPath) || path.basename(configPath)}.`);
  console.log(`Linked ${linkedPluginPath} -> ${localPluginPath}`);
  console.log("Next step: run `pnpm dev` or `pnpm build` from this repo.");
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

async function writeConfig(vaultPath) {
  const contents = JSON.stringify(
    {
      vaultPath,
      pluginId,
      localPluginPath,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  await fs.writeFile(configPath, `${contents}\n`, "utf8");
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

async function ensureSymlink(linkPath, targetPath) {
  const relativeTargetPath = path.relative(path.dirname(linkPath), targetPath);
  const resolvedTargetPath = path.resolve(targetPath);

  try {
    const existingStats = await fs.lstat(linkPath);

    if (existingStats.isSymbolicLink()) {
      const existingTargetPath = await fs.readlink(linkPath);
      const resolvedExistingTargetPath = path.resolve(path.dirname(linkPath), existingTargetPath);

      if (resolvedExistingTargetPath === resolvedTargetPath) {
        return;
      }

      await fs.unlink(linkPath);
    } else {
      const backupPath = await moveExistingPathAside(linkPath);
      console.log(`Moved existing plugin directory to ${backupPath}`);
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  await fs.symlink(relativeTargetPath, linkPath, "dir");
}

async function moveExistingPathAside(existingPath) {
  const backupPath = await getAvailableBackupPath(existingPath);
  await fs.rename(existingPath, backupPath);
  return backupPath;
}

async function getAvailableBackupPath(existingPath) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const baseBackupPath = `${existingPath}.backup-${timestamp}`;
  let candidatePath = baseBackupPath;
  let suffix = 1;

  for (;;) {
    try {
      await fs.lstat(candidatePath);
      candidatePath = `${baseBackupPath}-${suffix}`;
      suffix += 1;
    } catch (error) {
      if (isMissingFileError(error)) {
        return candidatePath;
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
  console.error(`Setup failed: ${message}`);
  process.exitCode = 1;
});
