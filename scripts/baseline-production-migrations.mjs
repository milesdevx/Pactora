import path from "node:path";
import postgres from "postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for production migration baselining.");

const apply = process.argv.includes("--apply");
const migrations = readMigrationFiles({ migrationsFolder: path.resolve("drizzle") });
if (migrations.length < 3) throw new Error("Expected migrations 0000 through 0002.");

const requiredTables = [
  "agreement_metadata", "auth_nonces", "notification_jobs", "telegram_link_tokens", "telegram_links", "users", "webhook_events",
  "wallet_sessions", "rate_limits", "milestone_evidence",
];
const requiredColumns = [
  "agreement_metadata.escrow_address", "agreement_metadata.chain_verified", "agreement_metadata.creation_tx_hash",
  "auth_nonces.message", "telegram_link_tokens.issued_with_session", "telegram_links.wallet_verified",
];
const upgradeColumns = ["agreement_metadata.chain_id", "agreement_metadata.verification_status"];
const database = postgres(connectionString, { prepare: false, max: 1, connect_timeout: 10 });

try {
  const result = await database.begin(async (transaction) => {
    if (!apply) await transaction.unsafe("SET TRANSACTION READ ONLY");
    await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtext('pactora-production-migration-baseline'))");

    const columns = await transaction`
      SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
    `;
    const availableColumns = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
    const availableTables = new Set(columns.map((row) => row.table_name));
    const missingTables = requiredTables.filter((table) => !availableTables.has(table));
    const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));
    const alreadyUpgraded = upgradeColumns.filter((column) => availableColumns.has(column));
    if (missingTables.length || missingColumns.length || alreadyUpgraded.length) {
      throw new Error(`Production schema is not the expected 0001 baseline (missing tables: ${missingTables.join(",") || "none"}; missing columns: ${missingColumns.join(",") || "none"}; 0002 columns present: ${alreadyUpgraded.join(",") || "none"}).`);
    }

    const indexes = await transaction`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'agreement_metadata'
    `;
    if (!indexes.some((row) => row.indexname === "agreement_metadata_verified_escrow_id_unique")) {
      throw new Error("Expected the 0001 verified escrow agreement index before applying 0002.");
    }

    const [journal] = await transaction`SELECT to_regclass('drizzle.__drizzle_migrations') AS name`;
    let existing = [];
    if (journal.name) existing = await transaction.unsafe('SELECT hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at ASC');
    const baseline = migrations.slice(0, 2);
    const exactExisting = existing.length === 2 && existing.every((row, index) => row.hash === baseline[index].hash && Number(row.created_at) === baseline[index].folderMillis);
    if (existing.length && !exactExisting) throw new Error("Existing Drizzle migration journal does not match the verified 0000/0001 baseline.");

    if (apply && !exactExisting) {
      await transaction.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');
      await transaction.unsafe('CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)');
      for (const migration of baseline) {
        await transaction`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES (${migration.hash}, ${migration.folderMillis})`;
      }
    }

    return { mode: apply ? "apply" : "dry-run", ready: true, alreadyBaselined: exactExisting, baselineEntries: baseline.length };
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await database.end();
}
