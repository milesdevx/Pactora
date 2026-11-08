import { createPublicClient, getContractAddress, http, isAddress, keccak256, parseAbi } from "viem";

const address = (process.argv[2] || process.env.NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS || "").toLowerCase();
if (!isAddress(address)) throw new Error("Provide an actual public escrow address.");
const client = createPublicClient({ transport: http("https://rpc.test.mezo.org", { timeout: 30_000, retryCount: 1 }) });
const abi = parseAbi(["function VERSION() view returns (uint256)", "function owner() view returns (address)", "function getAgreementCount() view returns (uint256)"]);
let stage = "chain identity";

try {
  const chainId = await client.getChainId();
  if (chainId !== 31611) throw new Error("Refusing a non-Mezo-Testnet RPC.");
  stage = "current bytecode";
  const head = await client.getBlockNumber({ cacheTime: 0 });
  const code = await client.getBytecode({ address, blockNumber: head });
  if (!code || code === "0x") throw new Error("No contract code exists at the supplied testnet address.");
  let version = null;
  stage = "current contract getters";
  try { version = String(await client.readContract({ address, abi, functionName: "VERSION", blockNumber: head })); } catch { /* V1 has no version getter. */ }
  const owner = await client.readContract({ address, abi, functionName: "owner", blockNumber: head });
  const count = await client.readContract({ address, abi, functionName: "getAgreementCount", blockNumber: head });

  // Pactora is immutable and has no self-destruct path: locate the first block with code.
  let low = 0n;
  let high = head;
  while (low < high) {
    const middle = (low + high) / 2n;
    stage = `historical bytecode at block ${middle}`;
    const historical = await client.getBytecode({ address, blockNumber: middle });
    if (historical && historical !== "0x") high = middle;
    else low = middle + 1n;
  }
  stage = `creation block ${low}`;
  const block = await client.getBlock({ blockNumber: low, includeTransactions: true });
  let deployment = null;
  for (const transaction of block.transactions) {
    if (transaction.to !== null) continue;
    if (getContractAddress({ from: transaction.from, nonce: BigInt(transaction.nonce) }).toLowerCase() !== address) continue;
    stage = "creation receipt";
    const receipt = await client.getTransactionReceipt({ hash: transaction.hash });
    if (receipt.contractAddress?.toLowerCase() !== address) continue;
    if (receipt.status !== "success") throw new Error("Creation receipt did not succeed.");
    deployment = { txHash: transaction.hash, deployer: transaction.from, blockNumber: low.toString(), timestamp: new Date(Number(block.timestamp) * 1000).toISOString(), status: receipt.status };
    break;
  }
  if (!deployment) throw new Error("Creation block found, but its matching creation transaction was not found.");
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), chainId, escrow: address, version, v2Verified: version === "2", owner, agreementCount: count.toString(), runtimeCodeHash: keccak256(code), deployment }, null, 2));
} catch (error) {
  const details = typeof error.details === "string" ? error.details : "";
  console.error(JSON.stringify({ code: "TESTNET_DEPLOYMENT_LOOKUP_FAILED", stage,
    error: String(error.shortMessage || error.message || "Lookup failed").slice(0, 300),
    details: /<html|<script|<!doctype/i.test(details) ? "RPC returned HTML; body suppressed" : details.slice(0, 300) || null,
    httpStatus: error.status || error.cause?.status || null }));
  process.exitCode = 1;
}
