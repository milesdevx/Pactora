import { formatUnits, maxUint256, parseUnits } from "viem";

export function parseMusdAmount(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value)) throw new Error("Use a non-negative MUSD amount with at most 18 decimal places.");
  const amount = parseUnits(value, 18);
  if (amount > maxUint256) throw new Error("Amount exceeds the contract's uint256 limit.");
  return amount;
}

export function formatMusdAmount(amount: bigint): string {
  return formatUnits(amount, 18);
}

export function percentageOf(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((part * 10_000n) / total) / 100;
}

export function formatChainTime(seconds: bigint): string {
  const value = new Date(Number(seconds) * 1000);
  return Number.isFinite(value.getTime()) ? value.toISOString() : `${seconds} Unix seconds (outside calendar range)`;
}
