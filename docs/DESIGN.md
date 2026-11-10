---
name: Pactora
description: MUSD escrow for milestone payments
colors:
  background: "#080d1a"
  surface: "#0f172a"
  surface-card: "#131d35"
  surface-border: "#1e293b"
  text-primary: "#f8fafc"
  text-secondary: "#94a3b8"
  text-muted: "#64748b"
  accent-teal: "#14b8a6"
  accent-teal-hover: "#0d9488"
  accent-teal-subtle: "rgba(20, 184, 166, 0.12)"
  warning-amber: "#f59e0b"
  error-rose: "#f43f5e"
  success-emerald: "#10b981"
typography:
  display:
    fontFamily: "Syne, var(--font-display)"
    fontWeight: [700]
    usage: "Hero and H1 only"
    fontSize: "clamp(2.25rem, 6vw, 4rem)"
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  body:
    fontFamily: "DM Sans, var(--font-sans)"
    fontWeight: [400, 500, 600]
    usage: "All UI text"
    fontSize: "0.9375rem"
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, var(--font-mono)"
    fontWeight: [400, 500]
    usage: "Addresses, hashes, amounts"
    tabularNums: true
    fontSize: "0.8125rem"
    letterSpacing: "-0.01em"
motion:
  principle: "Motion carries meaning; pulses mark the user's required action; success only after confirmation."
  gradients: "teal-only"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-teal}"
    textColor: "#041e1b"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-teal-hover}"
---

# Design System

## Overview

Pactora delivers a trustworthy, precise, and calm fintech experience tailored for milestone escrow coordination on the Mezo network. The visual identity reflects security, high data clarity, and operational confidence without generic Web3 tropes or superficial decoration.

## Colors

- **Primary Background**: `#080d1a` — Deep night navy providing high contrast and calm focus.
- **Surfaces**: `#0f172a` (containers), `#131d35` (cards and panels), `#1e293b` (crisp structural borders).
- **Text**: `#f8fafc` (high-contrast primary), `#94a3b8` (secondary metadata), `#64748b` (muted timestamps and labels).
- **Accents**: Restrained teal (`#14b8a6`) for affirmative primary actions, emerald (`#10b981`) for completed states, amber (`#f59e0b`) for pending/action-required items, and rose (`#f43f5e`) for rejections or cancellations.

## Typography

- **Headings**: Clean sans-serif with tight tracking (`-0.025em`) conveying authority.
- **Body**: Highly readable sans-serif at 15px with relaxed line height (`1.5`).
- **Data & Balances**: Tabular figures for amounts, milestone sums, and countdowns.
- **Hashes & Addresses**: Monospaced font with visual truncation and one-click copy feedback.

## Layout

- Responsive breakpoints: 360px mobile, 768px tablet, 1024px desktop, 1280px wide.
- Fixed top navigation with network indicator, testnet badge, and wallet controls.
- Persistent sidebar on desktop for dashboard views, collapsing cleanly into an accessible bottom or slide-out sheet on mobile.
- Generous internal padding (`24px` to `32px` on desktop) with structured vertical rhythm.

## Elevation & Depth

- Low elevation: Subtle single-pixel borders (`border-slate-800`) over surface cards instead of heavy drop shadows or blurry gradients.
- Selected and active states highlighted with subtle accent borders or low-opacity tinted backgrounds.

## Shapes

- Restrained corner radius (`6px` to `12px`) preventing cartoonish pill shapes on content containers.
- Inputs and buttons standardized to `8px` radius.

## Components

- **Milestone Timeline**: Vertical progression with clear state iconography (Draft, Funded, Submitted, Approved, Released).
- **Action Drawer/Modal**: Displays exact token, amount, recipient address, network, and irreversible consequences before wallet confirmation.
- **Receipt Cards**: Public, verifiable view of on-chain agreement state, events, and block explorer links.
- **Network Badge**: Prominent, persistent indicator showing "Mezo Testnet (31611)" with network health dot.

## Do's and Don'ts

- **Do** show exact token amounts, gas token warning, and destination addresses.
- **Do** disable interactive buttons with explicit loading indicators while transactions are pending on-chain.
- **Do** provide direct links to the Mezo Testnet block explorer for all transactions and contracts.
- **Don't** simulate fake balances, synthetic activity, or claim instant success before on-chain receipt confirmation.
- **Don't** use multi-color rainbow gradients, excessive glassmorphism, or non-functional decorative widgets.

