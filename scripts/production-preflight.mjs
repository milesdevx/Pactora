import postgres from "postgres";

const connection = process.env.DATABASE_URL;
if (!connection) throw new Error("DATABASE_URL is not configured; value suppressed.");
let database;
let stage = "connection";

function safeErrorMessage(error) {
  let message = typeof error?.message === "string" ? error.message : "Database error details unavailable";
  const values = Object.entries(process.env).filter(([name]) => /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DATABASE_URL)/i.test(name)).map(([, value]) => value).filter(Boolean);
  try {
    const url = new URL(connection);
    values.push(url.password, url.username, decodeURIComponent(url.password), decodeURIComponent(url.username));
  } catch { /* Connection parsing errors are redacted too. */ }
  for (const value of values.filter((value) => value.length >= 3).sort((left, right) => right.length - left.length)) message = message.split(value).join("[REDACTED]");
  return message.replace(/(?:postgres(?:ql)?|https?):\/\/\S+/gi, "[REDACTED URL]")
    .replace(/\b\d{5,15}:[A-Za-z0-9_-]{20,}\b/g, "[REDACTED TOKEN]")
    .replace(/0x[0-9a-fA-F]{64}\b/g, "[REDACTED HEX]").slice(0, 300);
}

try {
  database = postgres(connection, { prepare: false, max: 1, connect_timeout: 10 });
  const result = await database.begin("read only", async (sql) => {
    stage = "read-only transaction";
    const [{ transaction_read_only: readOnly }] = await sql`show transaction_read_only`;
    if (readOnly !== "on") throw new Error("READ_ONLY_TRANSACTION_REQUIRED");
    stage = "schema inspection";
    const tables = await sql`select table_schema, table_name from information_schema.tables where table_schema in ('public', 'drizzle')`;
    const names = new Set(tables.filter((table) => table.table_schema === "public").map((table) => table.table_name));
    const columns = await sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`;
    const hasColumn = (table, column) => columns.some((item) => item.table_name === table && item.column_name === column);
    const baseline = ["users", "telegram_links", "telegram_link_tokens", "auth_nonces", "agreement_metadata", "webhook_events", "notification_jobs"];
    const missingBaselineTables = baseline.filter((table) => !names.has(table));
    const duplicates = {};
    stage = "constraint/data preflight";
    if (names.has("telegram_links")) {
      const [users] = await sql`select count(*)::int as groups from (select user_id from telegram_links group by user_id having count(*) > 1) duplicates`;
      const [chats] = await sql`select count(*)::int as groups from (select telegram_chat_id from telegram_links group by telegram_chat_id having count(*) > 1) duplicates`;
      duplicates.linkedWalletGroups = users.groups;
      duplicates.linkedChatGroups = chats.groups;
    }
    let nonNormalizedWallets = null;
    if (names.has("users")) { const [count] = await sql`select count(*)::int as count from users where wallet_address <> lower(wallet_address)`; nonNormalizedWallets = count.count; }
    const migrationJournalPresent = tables.some((table) => table.table_schema === "drizzle" && table.table_name === "__drizzle_migrations");
    let appliedMigrationCount = null;
    if (migrationJournalPresent) { const [count] = await sql`select count(*)::int as count from drizzle.__drizzle_migrations`; appliedMigrationCount = count.count; }
    const v2 = {
      walletSessions: names.has("wallet_sessions"), rateLimits: names.has("rate_limits"), evidence: names.has("milestone_evidence"),
      storedNonceMessage: hasColumn("auth_nonces", "message"), scopedMetadata: hasColumn("agreement_metadata", "escrow_address"),
      verifiedMetadata: hasColumn("agreement_metadata", "chain_verified"), creationHash: hasColumn("agreement_metadata", "creation_tx_hash"),
      tokenProvenance: hasColumn("telegram_link_tokens", "issued_with_session"), verifiedLinks: hasColumn("telegram_links", "wallet_verified"),
    };
    return { readOnly: true, missingBaselineTables, duplicates, nonNormalizedWallets, migrationJournalPresent, appliedMigrationCount, v2, needsV2Schema: Object.values(v2).some((present) => !present), baselinePlanRequired: !migrationJournalPresent && missingBaselineTables.length === 0 };
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.missingBaselineTables.length || result.duplicates.linkedWalletGroups || result.duplicates.linkedChatGroups || result.nonNormalizedWallets) {
    console.error("PREFLIGHT_BLOCKED: schema or data needs explicit reconciliation; no production changes were made.");
    process.exitCode = 1;
  }
} catch (error) {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{3,32}$/.test(error.code) ? error.code : "PREFLIGHT_UNAVAILABLE";
  console.error(`Production preflight failed at ${stage}: ${code}: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
} finally {
  if (database) await database.end({ timeout: 5 });
}
