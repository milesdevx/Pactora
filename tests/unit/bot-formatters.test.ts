import { describe, expect, it } from "vitest";
import { formatAgreements, formatBalance, formatGetMusd, formatPending, nextAction, type BotAgreement } from "@/lib/telegram/formatters";

const client = `0x${"a".repeat(40)}`;
const provider = `0x${"b".repeat(40)}`;
const app = "https://pactora.test";
const fixture: BotAgreement = { id: 1, title: "Illustration <not live>", state: 2, client, provider, token: "0x118917a40faf1cd7a13db0ef56c86de7973ac503", total: 300000000000000000n, remaining: 300000000000000000n, legacy: false, now: 1000n, milestones: [{ index: 0, state: 1, amount: 100000000000000000n, submittedAt: 900n, deliveryDeadline: 2000n }, { index: 1, state: 3, amount: 200000000000000000n, rejectedAt: 900n, deliveryDeadline: 2000n }] };

describe("Bot formatters (Illustration unit fixtures, not live messages)", () => {
  it("preserves one-unit precision and BTC gas balances", () => {
    const text = formatBalance(client, 1n, 123456789012345678n, 5n, app);
    expect(text).toContain("0.000000000000000001"); expect(text).toContain("0.123456789012345678"); expect(text).toContain("no transaction was sent");
  });
  it("shows confirmed state, next action and escaped title", () => {
    const text = formatAgreements([fixture], client, app, true);
    expect(text).toContain("Funded"); expect(text).toContain("0.3 MUSD agreement total"); expect(text).toContain("&lt;not live&gt;"); expect(text).toContain("Review submitted milestone 1");
  });
  it("shows only client review items or provider delivery items", () => {
    expect(formatPending([fixture], client, app, true)).toContain("milestone 1: Review submitted work");
    expect(formatPending([fixture], client, app, true)).not.toContain("milestone 2");
    expect(formatPending([fixture], provider, app, true)).toContain("milestone 2: Revise and resubmit");
    expect(formatPending([{ ...fixture, state: 3 }], provider, app, true)).toContain("No review/delivery items");
  });
  it("labels limited discovery instead of claiming a complete empty wallet", () => {
    expect(formatAgreements([], client, app, false)).toContain("not a full indexer"); expect(formatPending([], client, app, false)).toContain("unindexed agreements may be missing");
  });
  it("does not invent transaction links", () => {
    expect(formatAgreements([fixture], client, app, true)).not.toContain("/tx/");
    expect(formatAgreements([{ ...fixture, creationTxHash: `0x${"1".repeat(64)}` }], client, app, true)).toContain(`/tx/0x${"1".repeat(64)}`);
  });
  it("explains actual Mezo test funds and never promises a faucet MUSD mint", () => {
    const text = formatGetMusd(app); expect(text).toContain("https://testnet.mezo.org"); expect(text).toContain("https://faucet.test.mezo.org/"); expect(text).toContain("not direct MUSD");
  });
  it("identifies matured review claims and overdue refunds", () => {
    const submitted = { ...fixture, now: 900000n, milestones: [fixture.milestones[0]] };
    expect(nextAction(submitted, provider)).toContain("Claim milestone 1");
    expect(nextAction({ ...submitted, milestones: [{ index: 0, state: 0, amount: 1n, deliveryDeadline: 2000n }] }, client)).toContain("Refund no-show");
  });
});
