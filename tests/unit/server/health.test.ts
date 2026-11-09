// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

const boundary = vi.hoisted(() => ({
  escrow: "0x2222222222222222222222222222222222222222" as const,
  musd: "0x3333333333333333333333333333333333333333" as const,
  rpc: { getChainId: vi.fn(), getBytecode: vi.fn(), readContract: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("viem", async (original) => ({ ...await original<typeof import("viem")>(), createPublicClient: () => boundary.rpc }));
vi.mock("@/lib/chain/mezo", () => ({ CONTRACT_ADDRESSES: { PACTORA_ESCROW: boundary.escrow, MUSD: boundary.musd }, mezoTestnet: { id: 31611 } }));

describe("escrow health check", () => {
  beforeEach(() => {
    boundary.rpc.getChainId.mockReset().mockResolvedValue(31611);
    boundary.rpc.getBytecode.mockReset().mockResolvedValue("0x6000");
    boundary.rpc.readContract.mockReset().mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "VERSION") return Promise.resolve(2n);
      if (functionName === "getAgreementCount") return Promise.resolve(3n);
      if (functionName === "defaultToken") return Promise.resolve(boundary.musd);
      if (functionName === "enforceTokenAllowlist") return Promise.resolve(true);
      throw new Error("Unexpected health view");
    });
  });

  it("returns no-store health only after code and V2 views respond", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.escrow).toEqual({ address: boundary.escrow, version: 2, agreementCount: "3", defaultToken: boundary.musd, allowlistEnforced: true });
  });

  it("fails when the configured address has no code", async () => {
    boundary.rpc.getBytecode.mockResolvedValue(undefined);
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("ESCROW_CODE_MISSING");
    expect(boundary.rpc.readContract).not.toHaveBeenCalled();
  });

  it("fails safely when VERSION is wrong or a known view reverts", async () => {
    boundary.rpc.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "VERSION") return Promise.resolve(1n);
      if (functionName === "defaultToken") return Promise.resolve(boundary.musd);
      if (functionName === "enforceTokenAllowlist") return Promise.resolve(true);
      return Promise.resolve(3n);
    });
    const wrongVersion = await GET();
    expect(wrongVersion.status).toBe(503);
    expect((await wrongVersion.json()).code).toBe("ESCROW_VERSION_MISMATCH");

    boundary.rpc.readContract.mockRejectedValue(new Error("private upstream detail"));
    const unavailable = await GET();
    expect(unavailable.status).toBe(503);
    const body = await unavailable.json();
    expect(body.code).toBe("ESCROW_VIEW_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("private upstream detail");
  });
});
