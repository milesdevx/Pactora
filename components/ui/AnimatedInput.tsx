import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const AnimatedInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100",
        "placeholder:text-slate-500 outline-none",
        "transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
        "focus-visible:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-400/30",
        "aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-400/30",
        className
      )}
      {...props}
    />
  )
);
AnimatedInput.displayName = "AnimatedInput";

