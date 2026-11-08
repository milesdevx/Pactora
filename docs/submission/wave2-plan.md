# Wave 2 and Post-Buildathon Plan: Draft

Prepared **2026-11-08**. Dates and counts below are targets unless explicitly marked completed. Owner V2 deployment and Wave 2 eligibility remain prerequisites, not assumed facts.

## What Changed After Wave 1

Repository history starts October 19, 2026, during the announced Wave 1 build period. Local November 7 commits added:

- `fa9c63e`: repository hygiene, dependency alignment, CI and browser smoke setup.
- `85ec3a7`: fail-closed wallet sessions, atomic nonce/link handling, confirmed-receipt notifications, verified immutable metadata/evidence, and approved V2 contract hardening/timeouts.
- `f8a5614`: `/balance`, `/agreements`, `/pending`, `/getmusd`, shared help and message-formatter tests.
- Local checks recorded 125 web/unit tests, 71 Foundry tests and two browser smoke tests passing. These are source/test results, not live delivery or payment proof.

V2 timeout/refund paths are already implemented and tested locally, not a speculative future feature. They are not available on the existing immutable V1 contract. MEZO funding UI, a complete event indexer, and independent review are still planned.

## Remaining Wave 2 Release: Conditional Targets

| Target | Deliverable | Dependency / Proof |
| --- | --- | --- |
| By November 10 | Owner deploys V2 on Mezo Testnet | Public successful deployment hash, correct owner/default MUSD/allowlist, `VERSION()==2`; no shared keys |
| By November 11 | Production schema, config, app and webhook upgraded | Baseline-aware DB plan; missing APP_URL/rate secret resolved; private signed relinking and actual command replies |
| By November 11 | Real two-wallet MUSD agreement completed | Create, accept, allowance, fund, submit, approve and receipt, each with actual confirmed hashes |
| By November 12 | Reviewed source and evidence published, deck/video exported | Real public source revision, CI result if run, verified screenshots, two-minute recording; no draft-as-finished claims |
| Before November 13, 05:30:06 UTC | Submit verified Track 2 materials | Owner confirms Wave 2 qualification and actual cutoff; missing live gates mean readiness is not claimed |

AKINDO's live API and Mezo's written schedule disagree. Use the earlier November 13 cutoff unless the organizers correct it; the written schedule says November 15. The November 23 winner announcement does not replace the submission deadline.

## First Four Weeks After the Buildathon

**Reliable chain discovery and notifications.** Build a resumable indexer scoped to chain, escrow address, agreement ID, transaction and log index. Persist a cursor, use successful receipts/finality checks, and replay idempotently after downtime. Stop relying on a browser callback for every notification. Add bounded automatic outbox retry and document delivery semantics; do not promise exactly-once Telegram delivery.

**MEZO support.** Reconfirm the official Mezo Testnet address, deployed code, decimals and exact-transfer behavior. Extend the owner-controlled allowlist only with explicit approval, then add a token selector, correct balance/shortfall display, receipts and real testnet transfer tests. The current submission does not claim MEZO integration. Do not guess a token address or use a mainnet address.

**Timeout/refund operationalization.** Reverify the already implemented seven-day review and rejection-grace boundaries. Add integration tests for client silence, provider no-show, proposal invalidation, transfer rollback and concurrent calls. Explain absolute agreed deadlines and that rejected deliverable quality still requires party agreement; there is no subjective arbitration.

## By Six Weeks: Review and Consenting Pilots

- Arrange an independent review of the contract, auth/session/nonce flows, DB concurrency, event processing and token assumptions. No external audit has been completed or promised by a named reviewer.
- Run real isolated PostgreSQL concurrency/rollback tests, which remain unverified because Docker was unavailable during local work.
- Target five consenting freelancer/client teams and ten real **testnet** agreements. These are recruitment/completion goals, not current users or metrics.
- Record completion/drop-off, confusion about allowance versus funding, wrong-network errors and notification reliability. Publish anonymized findings only with consent; do not invent successful pilots.
- Decide product/support/pricing priorities from those observations. The V2 contract has no claimed protocol revenue; any agency-service model is a hypothesis to validate.

## Longer-Term Commitment

Maintain the public repo, deployment/evidence record, reproducible tests, incident notes and release checkpoints after the event. Explore relevant Mezo/Supernormal builder programs only if eligible; no grant, partnership or acceptance is claimed. Any future production-network expansion would require separate security work and authorization. All work and demos in this submission remain Mezo Testnet only.

## Release Blockers Still Open

- V2 is not deployed; existing V1 retains disclosed issues and must not receive new funds through an assumed upgrade.
- Production lacks V2 tables/columns and a Drizzle migration baseline; no schema write has been performed.
- Production `APP_URL` and `RATE_LIMIT_SECRET` were absent in the read-only check.
- Real new-command replies, signed relinking/unlinking, full payment flow, live bundle/log checks and source verification remain pending.
- Public GitHub is behind local source; the published deck and pitch video do not yet exist.

See `../deployments.md` and `akindo-form.md` for observed values, required evidence and the no-fabrication checklist.
