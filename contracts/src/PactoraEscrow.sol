// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PactoraEscrow
 * @author Pactora Protocol
 * @notice Trust-minimized, milestone-based escrow coordination for the Mezo ecosystem.
 * Agreements are denominated and funded in ERC-20 tokens (e.g. MUSD).
 */
contract PactoraEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant VERSION = 2;
    uint64 public constant REVIEW_WINDOW = 7 days;

    enum AgreementState {
        Created, // Agreement created by client, awaiting provider acceptance
        Accepted, // Provider accepted terms, awaiting client funding
        Funded, // Client funded escrow, milestone work in progress
        Completed, // All escrow funds released to provider
        Cancelled // Agreement cancelled before funding or closed with a refund
    }

    enum MilestoneState {
        Pending, // Work not submitted or milestone pending
        Submitted, // Provider submitted deliverable hash/notes
        Approved, // Client approved milestone; funds released to provider
        Rejected, // Client rejected milestone; provider may resubmit within grace period
        Refunded // Client reclaimed this milestone after provider no-show
    }

    struct Milestone {
        uint256 amount;
        MilestoneState state;
        bytes32 submissionHash;
        bytes32 rejectionReasonHash;
        uint64 deliveryDeadline;
        uint64 submittedAt;
        uint64 rejectedAt;
    }

    struct Agreement {
        uint256 id;
        address client;
        address provider;
        address token;
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 refundedAmount;
        AgreementState state;
        bytes32 termsHash;
        uint64 createdAt;
        uint64 fundedAt;
        uint64 completedAt;
        uint256 milestoneCount;
    }

    struct ResolutionProposal {
        bool exists;
        address proposedBy;
        uint256 clientRefundAmount;
        uint256 providerReleaseAmount;
        bytes32 proposalHash;
    }

    // --- State Variables ---
    uint256 public nextAgreementId = 1;
    mapping(uint256 => Agreement) private _agreements;
    mapping(uint256 => mapping(uint256 => Milestone)) private _milestones;
    mapping(uint256 => ResolutionProposal) private _resolutionProposals;
    // Kept separately so deleting a proposal never reuses its identity.
    mapping(uint256 => uint256) private _resolutionNonces;

    // When enforced, only explicitly allowed token contracts may be used.
    address public immutable defaultToken;
    address public immutable owner;
    mapping(address => bool) public allowedTokens;
    bool public enforceTokenAllowlist;

    // --- Events ---
    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed client,
        address indexed provider,
        address token,
        uint256 totalAmount,
        bytes32 termsHash
    );
    event AgreementAccepted(uint256 indexed agreementId, address indexed provider);
    event AgreementFunded(uint256 indexed agreementId, address indexed client, uint256 amount);
    event MilestoneSubmitted(uint256 indexed agreementId, uint256 indexed milestoneIndex, bytes32 submissionHash);
    event MilestoneApproved(uint256 indexed agreementId, uint256 indexed milestoneIndex, uint256 amount);
    event MilestoneRejected(uint256 indexed agreementId, uint256 indexed milestoneIndex, bytes32 reasonHash);
    event MilestoneTimeoutClaimed(uint256 indexed agreementId, uint256 indexed milestoneIndex, uint256 amount);
    event MilestoneRefunded(uint256 indexed agreementId, uint256 indexed milestoneIndex, uint256 amount);
    event ResolutionProposed(
        uint256 indexed agreementId,
        address indexed proposedBy,
        uint256 clientRefund,
        uint256 providerRelease,
        bytes32 proposalHash
    );
    event ResolutionAccepted(
        uint256 indexed agreementId, uint256 clientRefund, uint256 providerRelease, bytes32 proposalHash
    );
    event ResolutionCancelled(uint256 indexed agreementId, address indexed cancelledBy, bytes32 proposalHash);
    event AgreementCancelled(uint256 indexed agreementId, address indexed cancelledBy, uint256 refundAmount);
    event AgreementCompleted(uint256 indexed agreementId);
    event TokenAllowlistUpdated(address indexed token, bool allowed);

    // --- Custom Errors ---
    error InvalidAddress();
    error InvalidMilestones();
    error TokenNotAllowed();
    error AgreementDoesNotExist();
    error InvalidAgreementState(AgreementState expected, AgreementState actual);
    error NotClient();
    error NotProvider();
    error NotParty();
    error MilestoneOutOfBounds();
    error MilestoneNotPendingOrRejected();
    error MilestoneNotSubmitted();
    error MilestoneAlreadyApproved();
    error InvalidResolutionAmounts();
    error NoActiveResolutionProposal();
    error ProposalAlreadyPending();
    error CannotAcceptOwnProposal();
    error NotOwner();
    error InvalidDeliveryDeadline();
    error DeliveryDeadlinePassed();
    error DeliveryDeadlineNotReached();
    error ReviewWindowOpen();
    error ReviewWindowClosed();
    error MilestoneNotRefundable();
    error ProposalHashMismatch();
    error InexactTokenTransfer();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @notice Construct escrow contract with designated default token (e.g. MUSD on Mezo)
     * @param _defaultToken Canonical MUSD token address
     * @param _enforceAllowlist Whether to strictly enforce the token allowlist
     */
    constructor(address _defaultToken, bool _enforceAllowlist) {
        if (_defaultToken == address(0) || _defaultToken.code.length == 0) revert InvalidAddress();
        owner = msg.sender;
        defaultToken = _defaultToken;
        enforceTokenAllowlist = _enforceAllowlist;
        allowedTokens[_defaultToken] = true;
        emit TokenAllowlistUpdated(_defaultToken, true);
    }

    /**
     * @notice Admin function to configure allowed tokens
     */
    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        if (token == address(0) || (allowed && token.code.length == 0)) revert InvalidAddress();
        allowedTokens[token] = allowed;
        emit TokenAllowlistUpdated(token, allowed);
    }

    /**
     * @notice Check whether a token is allowed for agreement creation
     */
    function isTokenAllowed(address token) public view returns (bool) {
        if (token == address(0) || token.code.length == 0) return false;
        return !enforceTokenAllowlist || allowedTokens[token];
    }

    /**
     * @notice Create a new milestone escrow agreement
     * @param provider Address of the freelancer/contractor
     * @param token ERC-20 token address (e.g. MUSD)
     * @param milestoneAmounts Array of individual milestone payout amounts
     * @param deliveryDeadlines Future per-milestone deadlines, consented to on provider acceptance
     * @param termsHash Hash of the agreed specifications/terms
     */
    function createAgreement(
        address provider,
        address token,
        uint256[] calldata milestoneAmounts,
        uint64[] calldata deliveryDeadlines,
        bytes32 termsHash
    ) external returns (uint256 agreementId) {
        if (provider == address(0) || provider == msg.sender) revert InvalidAddress();
        if (!isTokenAllowed(token)) revert TokenNotAllowed();
        if (
            milestoneAmounts.length == 0 || milestoneAmounts.length > 50
                || deliveryDeadlines.length != milestoneAmounts.length
        ) revert InvalidMilestones();

        uint256 total = 0;
        agreementId = nextAgreementId++;

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            uint256 amount = milestoneAmounts[i];
            if (amount == 0) revert InvalidMilestones();
            if (deliveryDeadlines[i] <= block.timestamp) revert InvalidDeliveryDeadline();
            total += amount;

            _milestones[agreementId][i] = Milestone({
                amount: amount,
                state: MilestoneState.Pending,
                submissionHash: bytes32(0),
                rejectionReasonHash: bytes32(0),
                deliveryDeadline: deliveryDeadlines[i],
                submittedAt: 0,
                rejectedAt: 0
            });
        }

        _agreements[agreementId] = Agreement({
            id: agreementId,
            client: msg.sender,
            provider: provider,
            token: token,
            totalAmount: total,
            releasedAmount: 0,
            refundedAmount: 0,
            state: AgreementState.Created,
            termsHash: termsHash,
            createdAt: uint64(block.timestamp),
            fundedAt: 0,
            completedAt: 0,
            milestoneCount: milestoneAmounts.length
        });

        emit AgreementCreated(agreementId, msg.sender, provider, token, total, termsHash);
    }

    /**
     * @notice Provider accepts the agreement terms
     * @param agreementId Agreement ID
     */
    function acceptAgreement(uint256 agreementId) external {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.provider) revert NotProvider();
        if (agreement.state != AgreementState.Created) {
            revert InvalidAgreementState(AgreementState.Created, agreement.state);
        }

        agreement.state = AgreementState.Accepted;
        emit AgreementAccepted(agreementId, msg.sender);
    }

    /**
     * @notice Client deposits the full MUSD amount into the escrow contract
     * @param agreementId Agreement ID
     */
    function fundAgreement(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client) revert NotClient();
        if (agreement.state != AgreementState.Accepted) {
            revert InvalidAgreementState(AgreementState.Accepted, agreement.state);
        }
        for (uint256 i = 0; i < agreement.milestoneCount; i++) {
            if (block.timestamp >= _milestones[agreementId][i].deliveryDeadline) revert DeliveryDeadlinePassed();
        }

        IERC20 token = IERC20(agreement.token);
        uint256 senderBefore = token.balanceOf(msg.sender);
        uint256 escrowBefore = token.balanceOf(address(this));

        agreement.state = AgreementState.Funded;
        agreement.fundedAt = uint64(block.timestamp);

        emit AgreementFunded(agreementId, msg.sender, agreement.totalAmount);

        token.safeTransferFrom(msg.sender, address(this), agreement.totalAmount);

        uint256 senderAfter = token.balanceOf(msg.sender);
        uint256 escrowAfter = token.balanceOf(address(this));
        if (
            senderAfter > senderBefore || senderBefore - senderAfter != agreement.totalAmount
                || escrowAfter < escrowBefore || escrowAfter - escrowBefore != agreement.totalAmount
        ) revert InexactTokenTransfer();
    }

    /**
     * @notice Provider submits milestone deliverable evidence
     * @param agreementId Agreement ID
     * @param milestoneIndex Index of milestone (0-indexed)
     * @param submissionHash Hash/URI reference to deliverable evidence
     */
    function submitMilestone(uint256 agreementId, uint256 milestoneIndex, bytes32 submissionHash) external {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.provider) revert NotProvider();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }
        if (milestoneIndex >= agreement.milestoneCount) revert MilestoneOutOfBounds();

        Milestone storage milestone = _milestones[agreementId][milestoneIndex];
        if (milestone.state != MilestoneState.Pending && milestone.state != MilestoneState.Rejected) {
            revert MilestoneNotPendingOrRejected();
        }
        if (block.timestamp >= _submissionDeadline(milestone)) revert DeliveryDeadlinePassed();

        milestone.state = MilestoneState.Submitted;
        milestone.submissionHash = submissionHash;
        milestone.rejectionReasonHash = bytes32(0);
        milestone.submittedAt = uint64(block.timestamp);
        milestone.rejectedAt = 0;

        emit MilestoneSubmitted(agreementId, milestoneIndex, submissionHash);
    }

    /**
     * @notice Client approves submitted milestone and releases payment to provider
     * @param agreementId Agreement ID
     * @param milestoneIndex Index of milestone (0-indexed)
     */
    function approveMilestone(uint256 agreementId, uint256 milestoneIndex) external nonReentrant {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client) revert NotClient();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }
        if (milestoneIndex >= agreement.milestoneCount) revert MilestoneOutOfBounds();

        Milestone storage milestone = _milestones[agreementId][milestoneIndex];
        if (milestone.state != MilestoneState.Submitted) revert MilestoneNotSubmitted();

        _releaseMilestone(agreement, milestone, milestoneIndex);
    }

    /**
     * @notice Provider claims a submitted milestone after seven days without rejection.
     */
    function claimAfterTimeout(uint256 agreementId, uint256 milestoneIndex) external nonReentrant {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.provider) revert NotProvider();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }
        if (milestoneIndex >= agreement.milestoneCount) revert MilestoneOutOfBounds();

        Milestone storage milestone = _milestones[agreementId][milestoneIndex];
        if (milestone.state != MilestoneState.Submitted) revert MilestoneNotSubmitted();
        if (block.timestamp < uint256(milestone.submittedAt) + REVIEW_WINDOW) revert ReviewWindowOpen();

        emit MilestoneTimeoutClaimed(agreementId, milestoneIndex, milestone.amount);
        _releaseMilestone(agreement, milestone, milestoneIndex);
    }

    /**
     * @notice Client refunds only an undelivered milestone after its delivery or resubmission deadline.
     */
    function refundNoShow(uint256 agreementId, uint256 milestoneIndex) external nonReentrant {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client) revert NotClient();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }
        if (milestoneIndex >= agreement.milestoneCount) revert MilestoneOutOfBounds();

        Milestone storage milestone = _milestones[agreementId][milestoneIndex];
        if (milestone.state != MilestoneState.Pending && milestone.state != MilestoneState.Rejected) {
            revert MilestoneNotRefundable();
        }
        if (block.timestamp < _submissionDeadline(milestone)) revert DeliveryDeadlineNotReached();

        milestone.state = MilestoneState.Refunded;
        agreement.refundedAmount += milestone.amount;
        _invalidateResolutionProposal(agreementId);
        emit MilestoneRefunded(agreementId, milestoneIndex, milestone.amount);
        _closeIfSettled(agreement);
        _transferExact(agreement.token, agreement.client, milestone.amount);
    }

    /**
     * @notice Client rejects submitted milestone with a clear reason hash
     * @param agreementId Agreement ID
     * @param milestoneIndex Index of milestone (0-indexed)
     * @param reasonHash Hash/URI describing why the submission was rejected
     */
    function rejectMilestone(uint256 agreementId, uint256 milestoneIndex, bytes32 reasonHash) external {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client) revert NotClient();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }
        if (milestoneIndex >= agreement.milestoneCount) revert MilestoneOutOfBounds();

        Milestone storage milestone = _milestones[agreementId][milestoneIndex];
        if (milestone.state != MilestoneState.Submitted) revert MilestoneNotSubmitted();
        if (block.timestamp >= uint256(milestone.submittedAt) + REVIEW_WINDOW) revert ReviewWindowClosed();

        milestone.state = MilestoneState.Rejected;
        milestone.rejectionReasonHash = reasonHash;
        milestone.rejectedAt = uint64(block.timestamp);

        emit MilestoneRejected(agreementId, milestoneIndex, reasonHash);
    }

    /**
     * @notice Cancel an agreement before funding.
     * Can be called by client if provider has not accepted yet, or by either party if un-funded.
     */
    function cancelUnfundedAgreement(uint256 agreementId) external {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client && msg.sender != agreement.provider) revert NotParty();
        if (agreement.state != AgreementState.Created && agreement.state != AgreementState.Accepted) {
            revert InvalidAgreementState(AgreementState.Created, agreement.state);
        }

        agreement.state = AgreementState.Cancelled;
        agreement.completedAt = uint64(block.timestamp);
        emit AgreementCancelled(agreementId, msg.sender, 0);
    }

    /**
     * @notice Propose a mutual resolution for a funded agreement.
     * Either client or provider specifies how the remaining balance should be split.
     * @param agreementId Agreement ID
     * @param clientRefundAmount Amount to return to client
     * @param providerReleaseAmount Amount to release to provider
     */
    function proposeResolution(uint256 agreementId, uint256 clientRefundAmount, uint256 providerReleaseAmount)
        external
    {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client && msg.sender != agreement.provider) revert NotParty();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }

        uint256 remaining = getRemainingBalance(agreementId);
        if (clientRefundAmount > remaining || providerReleaseAmount != remaining - clientRefundAmount) {
            revert InvalidResolutionAmounts();
        }

        _invalidateResolutionProposal(agreementId);
        uint256 nonce = ++_resolutionNonces[agreementId];
        bytes32 proposalHash = keccak256(
            abi.encode(
                address(this), block.chainid, agreementId, nonce, msg.sender, clientRefundAmount, providerReleaseAmount
            )
        );
        _resolutionProposals[agreementId] = ResolutionProposal({
            exists: true,
            proposedBy: msg.sender,
            clientRefundAmount: clientRefundAmount,
            providerReleaseAmount: providerReleaseAmount,
            proposalHash: proposalHash
        });

        emit ResolutionProposed(agreementId, msg.sender, clientRefundAmount, providerReleaseAmount, proposalHash);
    }

    /**
     * @notice Accept the counterparty's pending resolution proposal.
     * Executes only the exact reviewed proposal and closes the agreement.
     * @param expectedProposalHash Identity read from the counterparty's proposal
     */
    function acceptResolutionProposal(uint256 agreementId, bytes32 expectedProposalHash) external nonReentrant {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client && msg.sender != agreement.provider) revert NotParty();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }

        ResolutionProposal memory proposal = _resolutionProposals[agreementId];
        if (!proposal.exists) revert NoActiveResolutionProposal();
        if (msg.sender == proposal.proposedBy) revert CannotAcceptOwnProposal();
        if (proposal.proposalHash != expectedProposalHash) revert ProposalHashMismatch();

        uint256 remaining = getRemainingBalance(agreementId);
        if (
            proposal.clientRefundAmount > remaining
                || proposal.providerReleaseAmount != remaining - proposal.clientRefundAmount
        ) {
            revert InvalidResolutionAmounts();
        }

        delete _resolutionProposals[agreementId];

        agreement.refundedAmount += proposal.clientRefundAmount;
        agreement.releasedAmount += proposal.providerReleaseAmount;

        emit ResolutionAccepted(
            agreementId, proposal.clientRefundAmount, proposal.providerReleaseAmount, proposal.proposalHash
        );
        _closeIfSettled(agreement);

        // Safe transfers
        if (proposal.providerReleaseAmount > 0) {
            _transferExact(agreement.token, agreement.provider, proposal.providerReleaseAmount);
        }
        if (proposal.clientRefundAmount > 0) {
            _transferExact(agreement.token, agreement.client, proposal.clientRefundAmount);
        }
    }

    /**
     * @notice Cancel a resolution proposal previously submitted by caller
     */
    function cancelResolutionProposal(uint256 agreementId) external {
        ResolutionProposal memory proposal = _resolutionProposals[agreementId];
        if (!proposal.exists) revert NoActiveResolutionProposal();
        if (msg.sender != proposal.proposedBy) revert NotParty();

        _invalidateResolutionProposal(agreementId);
    }

    function _submissionDeadline(Milestone storage milestone) private view returns (uint256 deadline) {
        deadline = milestone.deliveryDeadline;
        if (milestone.state == MilestoneState.Rejected) {
            uint256 graceDeadline = uint256(milestone.rejectedAt) + REVIEW_WINDOW;
            if (graceDeadline > deadline) deadline = graceDeadline;
        }
    }

    function _releaseMilestone(Agreement storage agreement, Milestone storage milestone, uint256 milestoneIndex)
        private
    {
        milestone.state = MilestoneState.Approved;
        agreement.releasedAmount += milestone.amount;
        _invalidateResolutionProposal(agreement.id);
        emit MilestoneApproved(agreement.id, milestoneIndex, milestone.amount);
        _closeIfSettled(agreement);
        _transferExact(agreement.token, agreement.provider, milestone.amount);
    }

    function _closeIfSettled(Agreement storage agreement) private {
        uint256 settled = agreement.releasedAmount + agreement.refundedAmount;
        require(settled <= agreement.totalAmount, "Invariant: exceeded total");
        if (settled == agreement.totalAmount) {
            agreement.completedAt = uint64(block.timestamp);
            if (agreement.refundedAmount == 0) {
                agreement.state = AgreementState.Completed;
                emit AgreementCompleted(agreement.id);
            } else {
                agreement.state = AgreementState.Cancelled;
                emit AgreementCancelled(agreement.id, msg.sender, agreement.refundedAmount);
            }
        }
    }

    function _invalidateResolutionProposal(uint256 agreementId) private {
        ResolutionProposal memory proposal = _resolutionProposals[agreementId];
        if (proposal.exists) {
            delete _resolutionProposals[agreementId];
            emit ResolutionCancelled(agreementId, msg.sender, proposal.proposalHash);
        }
    }

    function _transferExact(address tokenAddress, address recipient, uint256 amount) private {
        IERC20 token = IERC20(tokenAddress);
        uint256 escrowBefore = token.balanceOf(address(this));
        uint256 recipientBefore = token.balanceOf(recipient);
        token.safeTransfer(recipient, amount);
        uint256 escrowAfter = token.balanceOf(address(this));
        uint256 recipientAfter = token.balanceOf(recipient);
        if (
            escrowAfter > escrowBefore || escrowBefore - escrowAfter != amount || recipientAfter < recipientBefore
                || recipientAfter - recipientBefore != amount
        ) revert InexactTokenTransfer();
    }

    // --- View Functions ---

    /**
     * @notice Get remaining unreleased and unrefunded balance in escrow for an agreement
     */
    function getRemainingBalance(uint256 agreementId) public view returns (uint256) {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.state != AgreementState.Funded) {
            return 0;
        }
        return agreement.totalAmount - agreement.releasedAmount - agreement.refundedAmount;
    }

    /**
     * @notice Get full agreement details
     */
    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        return _agreements[agreementId];
    }

    /**
     * @notice Get specific milestone details
     */
    function getMilestone(uint256 agreementId, uint256 milestoneIndex) external view returns (Milestone memory) {
        return _milestones[agreementId][milestoneIndex];
    }

    /**
     * @notice Get all milestones for an agreement
     */
    function getMilestones(uint256 agreementId) external view returns (Milestone[] memory) {
        Agreement storage agreement = _agreements[agreementId];
        Milestone[] memory list = new Milestone[](agreement.milestoneCount);
        for (uint256 i = 0; i < agreement.milestoneCount; i++) {
            list[i] = _milestones[agreementId][i];
        }
        return list;
    }

    /**
     * @notice Get pending resolution proposal if any
     */
    function getResolutionProposal(uint256 agreementId) external view returns (ResolutionProposal memory) {
        return _resolutionProposals[agreementId];
    }

    /**
     * @notice Total number of agreements created
     */
    function getAgreementCount() external view returns (uint256) {
        return nextAgreementId - 1;
    }
}
