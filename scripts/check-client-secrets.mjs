import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const names = ["DATABASE_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "RATE_LIMIT_SECRET", "SESSION_SECRET", "DEPLOYER_PRIVATE_KEY", "PRIVATE_KEY"];
const failures = new Set();
let files = 0;
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (path.endsWith(".js") || path.endsWith(".map")) {
      files++;
      const contents = readFileSync(path, "utf8");
      for (const name of names) {
        if (contents.includes(`process.env.${name}`)) failures.add(`${name}: reference`);
        const value = process.env[name];
        if (value && value.length >= 8 && contents.includes(value)) failures.add(`${name}: configured value`);
      }
    }
  }
}
scan(".next/static");
if (!files) throw new Error("No client JavaScript was scanned; run the build first.");
if (failures.size) { console.error("Client secret scan FAILED (values suppressed):", [...failures].join(", ")); process.exit(1); }
console.log(`PASS: scanned ${files} client JavaScript/map files; no server-secret references or configured values found.`);
