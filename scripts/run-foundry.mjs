import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";

const executable = process.platform === "win32" ? resolve(homedir(), ".foundry/bin/forge.exe") : "forge";
const result = spawnSync(executable, process.argv.slice(2), { cwd: resolve("contracts"), stdio: "inherit" });
if (result.error) { console.error("Foundry is unavailable; install it from https://getfoundry.sh/"); process.exit(1); }
process.exit(result.status ?? 1);
