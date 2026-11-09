import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { zeroAddress } from "viem";
import { AgreementNotFoundState } from "@/components/agreements/AgreementNotFoundState";
import { isAgreementMissing } from "@/lib/chain/agreements";

const ESCROW = "0x2222222222222222222222222222222222222222";

describe("missing agreement state", () => {
  it("renders an empty struct as not found without a valid-looking state or balance", () => {
    const empty = { id: 0n, client: zeroAddress, provider: zeroAddress };
    expect(isAgreementMissing(empty, 42364n)).toBe(true);

    render(<AgreementNotFoundState agreementId="42364" escrowAddress={ESCROW} />);
    expect(screen.getByRole("heading", { name: "Agreement not found on this contract" })).toBeInTheDocument();
    expect(screen.getByText(ESCROW)).toBeInTheDocument();
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
    expect(screen.queryByText(/Awaiting Provider Acceptance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.00 MUSD/i)).not.toBeInTheDocument();
  });

  it("accepts a matching nonzero on-chain identity", () => {
    expect(isAgreementMissing({ id: 1n, client: "0x1111111111111111111111111111111111111111", provider: "0x2222222222222222222222222222222222222222" }, 1n)).toBe(false);
  });
});
