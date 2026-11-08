import "server-only";
import { createPublicClient, http, parseEventLogs, TransactionReceiptNotFoundError } from "viem";
import { CONTRACT_ADDRESSES, mezoTestnet } from "./mezo";
import { PACTORA_ESCROW_ABI } from "./abi/PactoraEscrow";
import { ApiError } from "@/lib/security/api";
import { WalletAddressSchema } from "@/lib/validation/schemas";
import { ERC20_ABI } from "./abi/IERC20";

export const mezoPublicClient = createPublicClient({ chain: mezoTestnet, transport: http("https://rpc.test.mezo.org", { timeout: 12_000, retryCount: 0 }) });

export function getEscrowAddress(): `0x${string}` {
  const result = WalletAddressSchema.safeParse(CONTRACT_ADDRESSES.PACTORA_ESCROW);
  if (!result.success) throw new ApiError(503, "Testnet escrow is not configured", "CONFIGURATION_REQUIRED");
  return result.data;
}

export async function requireTestnet() {
  if (await mezoPublicClient.getChainId() !== 31611) throw new ApiError(503, "Mezo Testnet RPC mismatch", "NETWORK_MISMATCH");
}

export async function readChainAgreement(id: number) {
  await requireTestnet();
  const address = getEscrowAddress();
  const blockNumber = await mezoPublicClient.getBlockNumber({ cacheTime: 0 });
  const count = await mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "getAgreementCount", blockNumber });
  if (BigInt(id) > count) throw new ApiError(404, "Not found on-chain for this contract address", "AGREEMENT_NOT_FOUND");
  const [agreement, milestones] = await Promise.all([
    mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "getAgreement", args: [BigInt(id)], blockNumber }),
    mezoPublicClient.readContract({ address, abi: PACTORA_ESCROW_ABI, functionName: "getMilestones", args: [BigInt(id)], blockNumber }),
  ]);
  const isZeroAddress = (addr?: string) => !addr || /^0x0{40}$/i.test(addr);
  if (agreement.id === 0n || isZeroAddress(agreement.client)) throw new ApiError(404, "Not found on-chain for this contract address", "AGREEMENT_NOT_FOUND");
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

export type EscrowDeploymentStatus = {
  ok: boolean;
  address: string;
  hasCode: boolean;
  viewFunctionResponds: boolean;
  agreementCount: number | null;
  version: number | null;
  isLegacy: boolean;
  error?: string;
};

export async function checkEscrowDeployment(): Promise<EscrowDeploymentStatus> {
  const address = getEscrowAddress();
  try {
    await requireTestnet();
    const bytecode = await mezoPublicClient.getBytecode({ address });
    if (!bytecode || bytecode === "0x") {
      return {
        ok: false,
        address,
        hasCode: false,
        viewFunctionResponds: false,
        agreementCount: null,
        version: null,
        isLegacy: false,
        error: `Escrow address ${address} has no deployed bytecode on Mezo Testnet (Chain ID 31611).`,
      };
    }

    let agreementCount: number | null = null;
    try {
      const count = await mezoPublicClient.readContract({
        address,
        abi: PACTORA_ESCROW_ABI,
        functionName: "getAgreementCount",
      });
      agreementCount = Number(count);
    } catch {
      return {
        ok: false,
        address,
        hasCode: true,
        viewFunctionResponds: false,
        agreementCount: null,
        version: null,
        isLegacy: false,
        error: `Contract at ${address} does not implement the expected getAgreementCount() view function.`,
      };
    }

    let version: number | null = null;
    try {
      const ver = await mezoPublicClient.readContract({
        address,
        abi: PACTORA_ESCROW_ABI,
        functionName: "VERSION",
      });
      version = Number(ver);
    } catch {
      version = 1; // Legacy V1 contract has no VERSION() view function
    }

    return {
      ok: true,
      address,
      hasCode: true,
      viewFunctionResponds: true,
      agreementCount,
      version,
      isLegacy: version !== 2,
    };
  } catch (error) {
    return {
      ok: false,
      address,
      hasCode: false,
      viewFunctionResponds: false,
      agreementCount: null,
      version: null,
      isLegacy: false,
      error: error instanceof Error ? error.message : "Escrow verification failed.",
    };
  }
}
