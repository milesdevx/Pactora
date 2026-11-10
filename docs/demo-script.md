# Pactora Testnet Verification Walkthrough

Last updated: **2026-11-10 UTC**. **Testnet only. Unaudited. No subjective dispute arbitration.**

This is an operational checklist, not a pitch or video script. Steps below describe what to verify; they do not claim those interactions have all occurred. Use two separate testnet wallets, the verified V2 address and actual receipts. Any sample amount or homepage preview is **Illustration, not real funds**.

## Verified Starting Point

The [deployment record](deployments.md) verifies the V2 contract and current app address cutover. [Public V2 receipt 1](https://pactora-tan.vercel.app/receipts/1) has real creation and provider-acceptance transactions but is Accepted/unfunded. Bot identity and webhook registration are verified, not private-chat delivery.

**Pending verification:** the remaining allowance/fund/submit/approve/payout run, signed Telegram linking and actual command/alert captures. Record only hashes from successful real receipts; never prepare substitute hashes or payment screenshots.

## Prepare

1. Open [help](https://pactora-tan.vercel.app/help) and confirm Mezo Testnet `31611`, canonical MUSD and the [V2 address](https://explorer.test.mezo.org/address/0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A).
2. Obtain test BTC through the [faucet](https://faucet.test.mezo.org/) and use the [Mezo testnet app](https://testnet.mezo.org) for MUSD. Keep BTC for gas. These URLs/guidance were checked, but actual asset acquisition is **Pending verification** in Phase 0.
3. Choose different client/provider wallets and agree on actual positive test-MUSD milestone amounts and future delivery deadlines. Keep keys/seed phrases in the wallets only. Read [security](security.md) before signing.
4. Use a valid signed session for both wallets before in-app writes; the app requests one automatically when absent. Working DB/auth routes are required, and verified metadata must load before provider acceptance in the UI. A wallet connection alone is not an authenticated session.

## Link Telegram

1. Open [Telegram settings](https://pactora-tan.vercel.app/settings/telegram) as each participant and use Generate One-Time Link.
2. Sign the custom five-minute authentication nonce, request the 15-minute single-use link and send `/start link_<token>` in the private [PactoraAlertsBot](https://t.me/PactoraAlertsBot) chat. There is no `/link` command.
3. Refresh link status and verify the actual stored own-wallet link. Capture the real reply only if it arrives; webhook HTTP success does not prove delivery.
4. Try `/help`, `/balance`, `/agreements`, `/pending`, `/getmusd` and `/notifications`. `/start` without a payload gives instructions; `/unlink` removes the link when finished. The bot guides, never signs money actions or executes borrowing.

## Create and Accept

1. As client, open [Create Agreement](https://pactora-tan.vercel.app/agreements/create), supply the provider, terms, positive MUSD amounts and future deadlines. Human-readable terms use keccak256 into `bytes32`, not SHA-256.
2. Review and sign the creation transaction. Wait for a successful receipt and read the actual ID from the configured-escrow `AgreementCreated` event. Never use a clock/random ID. Verify metadata registration separately; a saved title does not prove a chain transaction.
3. As provider, open that ID and inspect the parties/amounts/deadlines before accepting. A missing/default ID must show "Agreement not found on this contract". Record the actual acceptance receipt.

## Allowance and Deposit

1. As client, approve the exact total MUSD allowance for V2. Wait for its receipt. This is authorization, not deposited escrow.
2. Send `fundAgreement` separately. Every original delivery deadline must still be in the future. Record the successful funding receipt and actual token transfer into escrow.
3. Check the public receipt's funded amount and state. Do not equate an agreement total with funded assets. An alert can be claimed only if a real server-confirmed event message is received; notification delivery failure does not undo the chain transaction.

## Deliver and Release

1. As provider, submit actual notes or a URL before the delivery/resubmission cutoff. The hash commits to the supplied string, not the content fetched from a URL or proof of quality.
2. Wait for the successful submission receipt. Check that any stored evidence matches its author/event/hash; unavailable metadata must remain labelled unavailable.
3. As client, review the submission and approve. Inspect the actual full milestone amount, MUSD address and provider recipient before signing.
4. Record the approval receipt and actual provider MUSD transfer. Check `releasedAmount`, remaining balance and state in the public receipt; repeat only for real agreed milestones.

## Optional Timeout or Mutual Settlement Checks

`REVIEW_WINDOW` is **604,800 seconds**. Provider `claimAfterTimeout` starts at `submittedAt + 604800` for still-Submitted work; rejection must be strictly earlier. This is not an instant simulator operation. Local `vm.warp` tests are not seven days on Mezo Testnet.

Client `refundNoShow` starts at a Pending milestone's deadline or a Rejected milestone's `max(deliveryDeadline, rejectedAt + 604800)`. Submitted work is never eligible. These paths need real eligible states, elapsed chain time and transactions; live timeout/refund evidence is **Pending verification**.

Either party may propose a split of the remaining balance. The other party must review and accept the exact current `bytes32 proposalHash`; replacement or a release/refund can invalidate it. Fully settled agreements are Completed only if cumulative refund is zero, otherwise Cancelled. The contract does not judge quality, and mutual settlement need not finalize every milestone. Live mutual-settlement evidence is **Pending verification**.

## Record Evidence

Keep the chain/escrow/ID, successful create/accept/allowance/fund/submit/approve hashes, actual token transfers and public receipt link. Add only consented private-chat captures of replies that actually occurred; never publish tokens, wallet keys, session/link credentials or env values. Label illustrative figures **Illustration, not real funds**.

Use [deployments](deployments.md#lifecycle-evidence) for the existing partial run, [architecture](architecture.md) for exact source rules and [Wave 2](wave-2.md) for planned work. A local formatter, test fixture, homepage preview or registered webhook is not live payment/Telegram evidence.
