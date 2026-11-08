# Two-Minute Pitch: Draft Script and Shot List

Prepared **2026-11-08**. Total timeline: **120 seconds**. This is not a video file or proof of a completed demo.

## Recording Preconditions

Record the live-demo claims below only after owner V2 redeployment, production schema/config/app upgrade, real private-chat replies and the two-wallet MUSD flow are independently verified. Do not read the future demo narration as a claim about today's V1 deployment.

Never show a seed phrase, private key, keystore password, raw link/session token, database URL, or bot/webhook secret. Wallet address and confirmed transaction hashes may be shown. Testnet funds must be identified as test tokens.

If any local source/test view is used, visibly label it **Illustration: local test, not a live transaction**. Prefer the verified live demo; never splice simulated transaction success into live footage.

## 00:00-00:15: Problem, 15 Seconds

**Voiceover:**

Freelancers need confidence they will be paid, and clients need confidence work will arrive. Paying everything upfront shifts the risk; waiting until the end shifts it back. Telegram conversations do not settle that trade-off.

**Shot:** Presenter or a simple client/provider problem diagram. No invented testimonials or adoption metrics.

## 00:15-00:35: Solution, 20 Seconds

**Voiceover:**

Pactora turns a project into MUSD milestones on Mezo Testnet. The client defines amounts and delivery deadlines; the provider accepts. After funding, work is reviewed one milestone at a time. Wallets authorize transactions, while Telegram keeps participants oriented.

**Shot:** Actual V2 agreement builder and terms review after live release. Keep the Mezo Testnet label, exact token, amounts and provider visible. No fake prefilled payment evidence.

## 00:35-01:10: Live Demo, 35 Seconds

**Voiceover, only after the flow is verified:**

Here, two real test wallets create and accept this agreement. The client approves the exact MUSD allowance, then funds the escrow; those are separate transactions. The provider submits actual evidence, and the client approves the milestone. We open the successful receipt: this is the token contract, this is the recipient, and this is the confirmed transaction hash. We are showing testnet tokens, not real money, and no browser-reported success substitutes for chain confirmation.

**Shots:**

- Real creation/acceptance state, with the agreement ID decoded from its receipt.
- Exact allowance and funding confirmation dialogs; wallet signing may be time-compressed, but do not remove pending/reverted outcomes to invent a success.
- Provider submission and client approval with real evidence text.
- Public receipt and Mezo explorer for the actual successful payout hash, amount, token and recipient.

Record every transaction first, then select genuine footage. Transaction hashes for this segment are **pending**; none are supplied as illustrative stand-ins.

## 01:10-01:30: Telegram, 20 Seconds

**Voiceover, only after received replies are verified:**

In the linked private bot chat, balance shows MUSD and the BTC needed for gas. Agreements shows on-chain states and the next step; pending isolates work to review or deliver. Getmusd guides users to Mezo's actual faucet and testnet app.

**Shot:** Real received `/balance`, `/agreements`, `/pending` and `/getmusd` replies. Crop private chat identifiers if needed. Do not use a terminal formatter response as if it were delivered by Telegram.

## 01:30-01:50: Mezo Utility and Viability, 20 Seconds

**Voiceover:**

MUSD moves from existing Mezo liquidity into funded work and provider payments. We compose with the ERC-20 token, testnet RPC, wallet tooling, and Mezo's app, rather than promising invented yield. This is unaudited software; consistent accounting and accessible coordination are our starting point.

**Shot:** Actual MUSD contract/explorer, Mezo testnet app entry point and Pactora receipt. Show the testnet and unaudited caveats. Do not show a fake borrowing, Passport or yield transaction.

## 01:50-02:00: Roadmap, 10 Seconds

**Voiceover:**

Next we will add reliable event indexing, independently review security, and run consenting pilots. We are building beyond the buildathon.

**Shot:** Three planned milestones, actual repo/bot/live URLs, and **Track 2: Access and Distribution**. Label roadmap work as planned, not delivered.

## Production Checklist

- [ ] Actual V2 address and creation/funding/payout hashes are in the deployment record.
- [ ] Testnet label and token/recipient/amount remain legible in the demo.
- [ ] No secrets, simulated success, fake metrics or fabricated customer proof appear.
- [ ] New bot replies are recorded from the real private chat.
- [ ] Narration and visuals fit exactly 00:00-02:00 after rehearsal; the durations above add to 120 seconds.
- [ ] Publish the real video link; a script is not a required pitch-video submission.
