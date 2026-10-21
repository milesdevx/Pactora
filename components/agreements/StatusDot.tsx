"use client";

import { motion, useReducedMotion } from "framer-motion";

export function StatusDot({ yourMove }: { yourMove: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative flex h-3 w-3">
      {yourMove && !reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-teal-400/40"
          animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span className="relative h-3 w-3 rounded-full bg-teal-400" />
    </span>
  );
}

