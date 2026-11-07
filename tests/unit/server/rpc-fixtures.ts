import { encodeAbiParameters, encodeEventTopics, parseAbi } from "viem";
import type { Address, TransactionReceipt } from "viem";
import { vi } from "vitest";
import { ESCROW, MUSD, NOW, PROVIDER, TX_HASH, WALLET } from "./fixtures";

// Illustration RPC responses, not a deployed ABI/address/receipt verification.
export const chainConfig = { CONTRACT_ADDRESSES: { PACTORA_ESCROW: ESCROW, MUSD }, mezoTestnet: { id: 31611 } };
const eventAbi = parseAbi(["event AgreementCreated(uint256 indexed agreementId, address indexed client, address indexed provider, address token, uint256 totalAmount, bytes32 termsHash)"]);
export const TERMS_HASH = `0x${"a1".repeat(32)}` as `0x${string}`;

export function creationLog(address: Address = ESCROW, id = 1n, logIndex = 0, termsHash = TERMS_HASH): TransactionReceipt["logs"][number] {
  const topics = encodeEventTopics({ abi: eventAbi, eventName: "AgreementCreated", args: { agreementId: id, client: WALLET, provider: PROVIDER } }).map((topic) => {
    if (typeof topic !== "string") throw new Error("Illustration event must have concrete topics");
    return topic;
  });
  const [eventTopic, ...indexedTopics] = topics;
  if (!eventTopic) throw new Error("Illustration event must have a signature topic");
  return {
    address,
    topics: [eventTopic, ...indexedTopics],
    data: encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "bytes32" }], [MUSD, 10n ** 18n, termsHash]),
    blockHash: TX_HASH,
    blockNumber: 100n,
    logIndex,
    removed: false,
    transactionHash: TX_HASH,
    transactionIndex: 0,
  };
}

export function receipt(logs = [creationLog()], status: TransactionReceipt["status"] = "success"): TransactionReceipt {
  return {
    status, logs, transactionHash: TX_HASH, blockHash: TX_HASH, blockNumber: 100n,
    from: WALLET, to: ESCROW, contractAddress: null, cumulativeGasUsed: 1n,
    effectiveGasPrice: 0n, gasUsed: 1n, logsBloom: `0x${"00".repeat(256)}`,
    transactionIndex: 0, type: "eip1559",
  };
}

export function chainAgreement() {
  return {
    agreement: { id: 1n, client: WALLET, provider: PROVIDER, token: MUSD, totalAmount: 10n ** 18n, releasedAmount: 0n, refundedAmount: 0n, state: 0, termsHash: TERMS_HASH, createdAt: 1n, fundedAt: 0n, completedAt: 0n },
    milestones: [{ amount: 10n ** 18n, state: 0, submissionHash: TERMS_HASH, rejectionReasonHash: TERMS_HASH, deliveryDeadline: BigInt(NOW.getTime() / 1000 + 86400), submittedAt: 0n, rejectedAt: 0n }],
  };
}

type RpcBoundary = Record<"getChainId" | "getBlockNumber" | "getTransactionReceipt" | "readContract", ReturnType<typeof vi.fn>>;
export function illustrateRpc(rpc: RpcBoundary) {
  const state = chainAgreement();
  rpc.getChainId.mockReset().mockResolvedValue(31611);
  rpc.getBlockNumber.mockReset().mockResolvedValue(100n);
  rpc.getTransactionReceipt.mockReset().mockResolvedValue(receipt());
  rpc.readContract.mockReset().mockImplementation(({ functionName }: { functionName: string }) => {
    if (functionName === "getAgreementCount") return Promise.resolve(1n);
    if (functionName === "getAgreement") return Promise.resolve(state.agreement);
    if (functionName === "getMilestones") return Promise.resolve(state.milestones);
    throw new Error("Unexpected Illustration RPC operation");
  });
  return state;
}
