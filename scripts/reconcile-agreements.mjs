import postgres from "postgres";
import { createPublicClient, getAddress, http } from "viem";
import { PACTORA_ESCROW_ABI } from "../lib/chain/abi/PactoraEscrow.ts";
import { LEGACY_ESCROW_ADDRESS } from "../lib/chain/abi/LegacyPactoraEscrow.ts";
import { isAgreementMissing } from "../lib/chain/agreements.ts";
import { mezoTestnet } from "../lib/chain/mezo.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for agreement reconciliation.");

const apply = process.argv.includes("--apply");
const database = postgres(connectionString, { prepare: false, max: 1, connect_timeout: 10 });
const chain = createPublicClient({ chain: mezoTestnet, transport: http("https://rpc.test.mezo.org", { timeout: 20_000, retryCount: 0 }) });

try {
  if (await chain.getChainId() !== 31611) throw new Error("Mezo Testnet RPC returned the wrong chain ID.");
  const rows = await database`
    SELECT id, on_chain_id AS "onChainId", chain_id AS "chainId", escrow_address AS "escrowAddress",
      chain_verified AS "chainVerified", verification_status AS "verificationStatus"
    FROM agreement_metadata
    ORDER BY created_at ASC
  `;
  const bytecode = new Map();
  const checked = [];

  for (const row of rows) {
    if (Number(row.chainId) !== 31611) throw new Error(`Unsupported chain ID ${row.chainId} for agreement ${row.onChainId}.`);
    const address = getAddress(row.escrowAddress || LEGACY_ESCROW_ADDRESS).toLowerCase();
    let code = bytecode.get(address);
    if (code === undefined) {
      const fetched = await chain.getBytecode({ address });
      code = fetched && fetched !== "0x" ? fetched : null;
      bytecode.set(address, code);
    }

    let exists = false;
    if (code) {
      const agreement = await chain.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "getAgreement", args: [BigInt(row.onChainId)] });
      exists = !isAgreementMissing(agreement, BigInt(row.onChainId));
    }
    checked.push({ row, address, exists });
  }

  const affected = checked.filter(({ row, exists }) => !exists && row.verificationStatus !== "legacy_unverified");
  if (apply && affected.length) {
    await database.begin(async (transaction) => {
      for (const { row, address } of affected) {
        await transaction`
          UPDATE agreement_metadata
          SET chain_id = 31611, escrow_address = ${address}, chain_verified = false,
            verification_status = 'legacy_unverified', updated_at = now()
          WHERE id = ${row.id}
        `;
      }
    });
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    checked: checked.length,
    existingOnChain: checked.filter(({ exists }) => exists).length,
    legacyUnverified: affected.map(({ row, address }) => ({ chainId: 31611, escrowAddress: address, agreementId: Number(row.onChainId) })),
  }, null, 2));
} finally {
  await database.end();
}
