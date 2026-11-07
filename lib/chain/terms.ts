import { keccak256, stringToBytes } from "viem";

export type AgreementTerms = {
  title: string;
  description?: string;
  clientAddress: string;
  providerAddress: string;
  milestoneDetails: { title: string; amount: string; description?: string; deliveryDeadline: number }[];
};

export function hashAgreementTerms(terms: AgreementTerms): `0x${string}` {
  return keccak256(stringToBytes(JSON.stringify({
    title: terms.title,
    description: terms.description || "",
    client: terms.clientAddress.toLowerCase(),
    provider: terms.providerAddress.toLowerCase(),
    milestones: terms.milestoneDetails.map((milestone) => ({
      title: milestone.title, amount: milestone.amount, description: milestone.description || "", deliveryDeadline: milestone.deliveryDeadline,
    })),
  })));
}
