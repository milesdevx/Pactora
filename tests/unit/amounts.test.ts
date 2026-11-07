import { describe, expect, it } from "vitest";
import { formatMusdAmount, parseMusdAmount, percentageOf } from "@/lib/chain/amounts";
import { hashAgreementTerms } from "@/lib/chain/terms";

describe("exact MUSD arithmetic (Illustration unit fixtures, not live balances)", () => {
  it.each(["0", "1", "0.000000000000000001", "9007199254740993.123456789012345678"])("round trips %s exactly", (amount) => {
    expect(formatMusdAmount(parseMusdAmount(amount))).toBe(amount);
  });
  it.each(["-1", "1e3", "NaN", "", "01", "1.0000000000000000001"])("rejects ambiguous or invalid amount %s", (amount) => {
    expect(() => parseMusdAmount(amount)).toThrow();
  });
  it("sums without floating-point loss", () => {
    expect(formatMusdAmount(parseMusdAmount("0.1") + parseMusdAmount("0.2"))).toBe("0.3");
    expect(percentageOf(1n, 3n)).toBe(33.33);
  });
  it("includes consented deadlines and normalizes addresses in the terms commitment", () => {
    const terms = { title: "Illustration agreement", description: "Unit fixture", clientAddress: "0x" + "a".repeat(40), providerAddress: "0x" + "b".repeat(40), milestoneDetails: [{ title: "Illustration milestone", amount: "0.1", description: "", deliveryDeadline: 1_900_000_000 }] };
    expect(hashAgreementTerms(terms)).toBe(hashAgreementTerms({ ...terms, clientAddress: terms.clientAddress.toUpperCase() }));
    expect(hashAgreementTerms(terms)).not.toBe(hashAgreementTerms({ ...terms, milestoneDetails: [{ ...terms.milestoneDetails[0], deliveryDeadline: 1_900_000_001 }] }));
  });
});
