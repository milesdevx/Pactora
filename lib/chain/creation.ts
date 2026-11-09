import { decodeEventLog, type Address, type TransactionReceipt } from "viem";
import { PACTORA_ESCROW_ABI } from "./abi/PactoraEscrow";

export function decodeAgreementCreated(
  receipt: Pick<TransactionReceipt, "status" | "logs">,
  escrowAddress: Address,
  expectedClient: Address,
  expectedProvider?: Address,
) {
  if (receipt.status !== "success") throw new Error("Agreement creation transaction reverted.");

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== escrowAddress.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi: PACTORA_ESCROW_ABI, data: log.data, topics: log.topics, strict: true });
      if (event.eventName !== "AgreementCreated") continue;
      if (event.args.client.toLowerCase() !== expectedClient.toLowerCase()) continue;
      if (expectedProvider && event.args.provider.toLowerCase() !== expectedProvider.toLowerCase()) continue;
      if (event.args.agreementId === 0n) break;
      return event;
    } catch {
      // A receipt can contain unrelated token or wallet logs.
    }
  }

  throw new Error("Confirmed receipt does not contain the expected AgreementCreated event.");
}
