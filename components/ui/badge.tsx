import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./button";

export const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border border-teal-500/30 bg-teal-500/10 text-teal-300 font-medium",
        secondary:
          "border border-slate-700 bg-slate-800 text-slate-300",
        success:
          "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium",
        warning:
          "border border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium",
        destructive:
          "border border-rose-500/30 bg-rose-500/10 text-rose-400 font-medium",
        outline:
          "border border-slate-700 text-slate-300",
        testnet:
          "border border-amber-500/40 bg-amber-950/40 text-amber-300 font-mono text-[11px] tracking-wide",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

