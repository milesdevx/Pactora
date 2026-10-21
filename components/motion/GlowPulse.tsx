"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface GlowPulseProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function GlowPulse({
  children,
  color = "rgba(20, 184, 166, 0.4)",
  className = "",
}: GlowPulseProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`relative ${className}`}>
      <motion.div
        animate={{
          opacity: [0.35, 0.7, 0.35],
          scale: [0.98, 1.02, 0.98],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          boxShadow: `0 0 35px 2px ${color}`,
        }}
        className="absolute inset-0 rounded-xl pointer-events-none -z-10"
      />
      {children}
    </div>
  );
}

