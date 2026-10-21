"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

interface CountUpProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18, restDelta: 0.001 });
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals]
  );
  const display = useTransform(spring, (v) => `${prefix}${fmt.format(v)}${suffix}`);
  const finalText = `${prefix}${fmt.format(value)}${suffix}`;

  useEffect(() => {
    if (inView && !reduce) {
      mv.set(value);
    }
  }, [inView, reduce, value, mv]);

  if (reduce) {
    return (
      <span ref={ref} className={className}>
        {finalText}
      </span>
    );
  }

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{finalText}</span>
      <motion.span aria-hidden="true">{display}</motion.span>
    </span>
  );
}
