"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface StaggerChildrenProps {
  children: React.ReactNode;
  staggerDelay?: number;
  delayStart?: number;
  className?: string;
}

export function StaggerChildren({
  children,
  staggerDelay = 0.08,
  delayStart = 0,
  className = "",
}: StaggerChildrenProps) {
  const shouldReduceMotion = useReducedMotion();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : staggerDelay,
        delayChildren: delayStart,
      },
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
  y = 16,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  const item = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
    },
  };

  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

