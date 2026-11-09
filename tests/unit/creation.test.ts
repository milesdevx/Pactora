import { describe, expect, it } from "vitest";
import { decodeAgreementCreated } from "@/lib/chain/creation";
import { ESCROW, PROVIDER, WALLET } from "./server/fixtures";
import { creationLog, receipt } from "./server/rpc-fixtures";

describe("confirmed agreement creation decoding", () => {
  it("uses the AgreementCreated ID from the configured escrow receipt", () => {
    const event = decodeAgreementCreated(receipt([creationLog(ESCROW, 7n)]), ESCROW, WALLET, PROVIDER);
    expect(event.args.agreementId).toBe(7n);
    expect(event.args.client.toLowerCase()).toBe(WALLET);
    expect(event.args.provider.toLowerCase()).toBe(PROVIDER);
  });

  it("rejects reverted receipts before an ID can be used", () => {
    expect(() => decodeAgreementCreated(receipt([creationLog()], "reverted"), ESCROW, WALLET, PROVIDER)).toThrow("reverted");
  });

  it("rejects missing or mismatched creation events", () => {
    expect(() => decodeAgreementCreated(receipt([]), ESCROW, WALLET, PROVIDER)).toThrow("AgreementCreated");
    expect(() => decodeAgreementCreated(receipt([creationLog()]), ESCROW, PROVIDER, WALLET)).toThrow("AgreementCreated");
  });
});
