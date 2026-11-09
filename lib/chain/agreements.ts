import { zeroAddress } from "viem";

export const AGREEMENT_NOT_FOUND_MESSAGE = "Agreement not found on this contract";

type AgreementIdentity = {
  id: bigint;
  client: string;
  provider: string;
};

export function isAgreementMissing(agreement: AgreementIdentity | undefined, expectedId?: bigint) {
  if (!agreement) return false;
  return agreement.id === 0n
    || agreement.client.toLowerCase() === zeroAddress
    || agreement.provider.toLowerCase() === zeroAddress
    || (expectedId !== undefined && agreement.id !== expectedId);
}
