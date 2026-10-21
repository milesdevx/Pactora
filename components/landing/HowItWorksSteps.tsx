"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Lock, CheckCircle2 } from "lucide-react";

export function HowItWorksSteps() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-80px" });
  const shouldReduceMotion = useReducedMotion();

  const steps = [
    {
      num: 1,
      title: "Agree on Milestones",
      desc: "Client creates the agreement with deliverables, amounts in MUSD, and terms. The provider verifies and signs on-chain acceptance.",
      icon: FileText,
      accent: "teal",
    },
    {
      num: 2,
      title: "Fund Escrow in MUSD",
      desc: "Client locks the project total in the Pactora smart contract on Mezo. Both parties inspect on-chain escrow before work starts.",
      icon: Lock,
      accent: "amber",
    },
    {
      num: 3,
      title: "Verify & Release",
      desc: "Provider submits work deliverables. Client inspects proof and executes approval, immediately transferring funds to the provider.",
      icon: CheckCircle2,
      accent: "emerald",
    },
  ];

  return (
    <div ref={containerRef} className="relative mt-12 max-w-5xl mx-auto">
      {/* Connecting animated dashed line across cards on desktop */}
      <div className="hidden md:block absolute top-1/2 left-12 right-12 -translate-y-8 h-0.5 pointer-events-none -z-0">
        <svg className="w-full h-4 overflow-visible">
          <motion.line
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke="#1e293b"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
          <motion.line
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke="#14b8a6"
            strokeWidth="2"
            strokeDasharray="6 6"
            initial={{ pathLength: 0 }}
            animate={isInView ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 1.2, ease: "easeInOut" }}
          />
        </svg>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{
                duration: 0.5,
                delay: shouldReduceMotion ? 0 : idx * 0.2,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              whileHover={{ y: shouldReduceMotion ? 0 : -4 }}
            >
              <Card className="h-full border-slate-800 bg-[#0f172a]/90 backdrop-blur-sm hover:border-slate-700 transition-all shadow-lg group">
                <CardContent className="pt-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={isInView ? { scale: 1 } : { scale: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                        delay: shouldReduceMotion ? 0 : idx * 0.25 + 0.1,
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 font-bold border border-teal-500/20 group-hover:scale-110 transition-transform"
                    >
                      <Icon className="h-5 w-5" />
                    </motion.div>
                    <span className="text-xs font-mono text-slate-500 font-bold">
                      STEP 0{step.num}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed flex-1">
                    {step.desc}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-teal-400 font-medium">
                    <span>On-Chain Verified</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 font-mono">Mezo L2</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

