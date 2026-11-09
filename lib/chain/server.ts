import "server-only";
import { createPublicClient, http, parseEventLogs, TransactionReceiptNotFoundError } from "viem";
import { CONTRACT_ADDRESSES, mezoTestnet } from "./mezo";
import { PACTORA_ESCROW_ABI } from "./abi/PactoraEscrow";
import { ApiError } from "@/lib/security/api";
import { WalletAddressSchema } from "@/lib/validation/schemas";
import { ERC20_ABI } from "./abi/IERC20";
import { AGREEMENT_NOT_FOUND_MESSAGE, isAgreementMissing } from "./agreements";

export const mezoPublicClient = createPublicClient({ chain: mezoTestnet, transport: http("https://rpc.test.mezo.org", { timeout: 12_000, retryCount: 0 }) });

export function getEscrowAddress(): `0x${string}` {
  const result = WalletAddressSchema.safeParse(CONTRACT_ADDRESSES.PACTORA_ESCROW);
  if (!result.success) throw new ApiError(503, "Testnet escrow is not configured", "CONFIGURATION_REQUIRED");
  return result.data;
}

export async function requireTestnet() {
  if (await mezoPublicClient.getChainId() !== 31611) throw new ApiError(503, "Mezo Testnet RPC mismatch", "NETWORK_MISMATCH");
}

export async function checkEscrowConfiguration() {
  const address = getEscrowAddress();
  await requireTestnet();
  let code;
  try { code = await mezoPublicClient.getBytecode({ address }); }
  catch { throw new ApiError(503, "Mezo Testnet escrow bytecode could not be read", "ESCROW_CODE_UNAVAILABLE"); }
  if (!code || code === "0x") throw new ApiError(503, "Configured escrow address has no contract code", "ESCROW_CODE_MISSING");

  try {
    const [version, agreementCount, defaultToken, enforceTokenAllowlist, defaultTokenAllowed] = await Promise.all([
      mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "VERSION" }),
      mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "getAgreementCount" }),
      mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "defaultToken" }),
      mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "enforceTokenAllowlist" }),
      mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "isTokenAllowed", args: [CONTRACT_ADDRESSES.MUSD] }),
    ]);
    if (version !== 2n) throw new ApiError(503, "Configured escrow is not Pactora V2", "ESCROW_VERSION_MISMATCH");
    if (defaultToken.toLowerCase() !== CONTRACT_ADDRESSES.MUSD.toLowerCase()) throw new ApiError(503, "Configured escrow uses the wrong default token", "ESCROW_TOKEN_MISMATCH");
    if (!enforceTokenAllowlist) throw new ApiError(503, "Configured escrow token allowlist is disabled", "ESCROW_ALLOWLIST_DISABLED");
    if (!defaultTokenAllowed) throw new ApiError(503, "Canonical MUSD is not allowed by the configured escrow", "ESCROW_TOKEN_NOT_ALLOWED");
    return { address, version, agreementCount, defaultToken, enforceTokenAllowlist, defaultTokenAllowed };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Configured escrow does not expose Pactora V2 views", "ESCROW_VIEW_UNAVAILABLE");
  }
}

export async function readChainAgreement(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404, AGREEMENT_NOT_FOUND_MESSAGE, "AGREEMENT_NOT_FOUND");
  const address = getEscrowAddress();
  await requireTestnet();
  const blockNumber = await mezoPublicClient.getBlockNumber({ cacheTime: 0 });
  const count = await mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "getAgreementCount", blockNumber });
  if (BigInt(id) > count) throw new ApiError(404, AGREEMENT_NOT_FOUND_MESSAGE, "AGREEMENT_NOT_FOUND");
  const agreement = await mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "getAgreement", args: [BigInt(id)], blockNumber });
  if (isAgreementMissing(agreement, BigInt(id))) throw new ApiError(404, AGREEMENT_NOT_FOUND_MESSAGE, "AGREEMENT_NOT_FOUND");
  const milestones = await mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "getMilestones", args: [BigInt(id)], blockNumber });
  return { agreement, milestones, blockNumber };
}

export async function readTokenDetails(address: `0x${string}`) {
  await requireTestnet();
  const [symbol, decimals] = await Promise.all([
    mezoPublicClient.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
    mezoPublicClient.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
  ]);
  if (!symbol || symbol.length > 64 || decimals > 36) throw new ApiError(503, "Token metadata is unsupported", "UNSUPPORTED_TOKEN");
  return { symbol, decimals };
}

export async function readPartyAgreement(id: number, wallet: string) {
  try {
    const data = await readChainAgreement(id);
    if (![data.agreement.client.toLowerCase(), data.agreement.provider.toLowerCase()].includes(wallet.toLowerCase())) return null;
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function readConfirmedReceipt(txHash: `0x${string}`) {
  await requireTestnet();
  let receipt;
  try { receipt = await mezoPublicClient.getTransactionReceipt({ hash: txHash }); }
  catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) throw new ApiError(409, "Transaction is not confirmed yet", "TRANSACTION_PENDING");
    throw error;
  }
  if (receipt.status !== "success") throw new ApiError(409, "Transaction reverted; no notification sent", "TRANSACTION_REVERTED");
  const logs = parseEventLogs({ abi: PACTORA_ESCROW_ABI, logs: receipt.logs.filter((log) => log.address.toLowerCase() === getEscrowAddress()), strict: true });
  if (!logs.length) throw new ApiError(400, "No Pactora escrow event in transaction", "INVALID_TRANSACTION");
  return { receipt, logs };
}
