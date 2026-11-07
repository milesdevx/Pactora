import { parseAbi } from "viem";

// Read-only support for the existing deployed V1 agreement, not a write compatibility layer.
export const LEGACY_ESCROW_ADDRESS = "0x1da50726e11bf828358f6b840900c0a731b2b40f" as const;
export const LEGACY_ESCROW_ABI = parseAbi([
  "function getAgreementCount() view returns (uint256)",
  "function getAgreement(uint256) view returns ((uint256 id, address client, address provider, address token, uint256 totalAmount, uint256 releasedAmount, uint256 refundedAmount, uint8 state, bytes32 termsHash, uint64 createdAt, uint64 fundedAt, uint64 completedAt, uint256 milestoneCount))",
  "function getMilestones(uint256) view returns ((uint256 amount, uint8 state, bytes32 submissionHash, bytes32 rejectionReasonHash)[])",
  "event AgreementCreated(uint256 indexed agreementId, address indexed client, address indexed provider, address token, uint256 totalAmount, bytes32 termsHash)",
  "event AgreementAccepted(uint256 indexed agreementId, address indexed provider)",
  "event AgreementFunded(uint256 indexed agreementId, address indexed client, uint256 amount)",
  "event MilestoneSubmitted(uint256 indexed agreementId, uint256 indexed milestoneIndex, bytes32 submissionHash)",
  "event MilestoneApproved(uint256 indexed agreementId, uint256 indexed milestoneIndex, uint256 amount)",
  "event MilestoneRejected(uint256 indexed agreementId, uint256 indexed milestoneIndex, bytes32 reasonHash)",
  "event ResolutionProposed(uint256 indexed agreementId, address indexed proposedBy, uint256 clientRefund, uint256 providerRelease)",
  "event ResolutionAccepted(uint256 indexed agreementId, uint256 clientRefund, uint256 providerRelease)",
  "event ResolutionCancelled(uint256 indexed agreementId, address indexed cancelledBy)",
  "event AgreementCancelled(uint256 indexed agreementId, address indexed cancelledBy, uint256 refundAmount)",
  "event AgreementCompleted(uint256 indexed agreementId)",
]);
