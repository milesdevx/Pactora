const postgres = require('postgres');
const url = 'postgresql://postgres.kutryrdaeqrpdfrtqcqm:Pactora2026!@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require';
const sql = postgres(url);

async function main() {
  const deleted = await sql`DELETE FROM agreement_metadata WHERE on_chain_id IN (42364, 910954) RETURNING on_chain_id, title`;
  console.log('Deleted rows:', deleted);
  const remaining = await sql`SELECT count(*)::int as count FROM agreement_metadata`;
  console.log('Remaining agreement_metadata count:', remaining[0].count);
  await sql.end();
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
