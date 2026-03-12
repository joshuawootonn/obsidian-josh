import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const pluginSourceScript = path.join(scriptDirectory, "plugin-source.mjs");
const forwardedArgs = ["use-local", ...process.argv.slice(2)];
const result = spawnSync(process.execPath, [pluginSourceScript, ...forwardedArgs], {
  stdio: "inherit",
});

if (result.error) {
  console.error(`Setup failed: ${result.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
