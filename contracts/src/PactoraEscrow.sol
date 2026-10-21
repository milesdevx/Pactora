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

    enum AgreementState {
        Created,    // Agreement created by client, awaiting provider acceptance
        Accepted,   // Provider accepted terms, awaiting client funding
        Funded,     // Client funded escrow, milestone work in progress
        Completed,  // All milestones approved and released
        Cancelled   // Agreement cancelled or resolved via mutual consent
    }

    enum MilestoneState {
        Pending,    // Work not submitted or milestone pending
        Submitted,  // Provider submitted deliverable hash/notes
        Approved,   // Client approved milestone; funds released to provider
        Rejected    // Client rejected milestone; provider may resubmit
    }

    struct Milestone {
        uint256 amount;
        MilestoneState state;
        bytes32 submissionHash;
        bytes32 rejectionReasonHash;
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
    }

    // --- State Variables ---
    uint256 public nextAgreementId = 1;
    mapping(uint256 => Agreement) private _agreements;
    mapping(uint256 => mapping(uint256 => Milestone)) private _milestones;
    mapping(uint256 => ResolutionProposal) private _resolutionProposals;

    // Optional token allowlist (if empty or allowed, permits usage)
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
    event ResolutionProposed(
        uint256 indexed agreementId,
        address indexed proposedBy,
        uint256 clientRefund,
        uint256 providerRelease
    );
    event ResolutionAccepted(uint256 indexed agreementId, uint256 clientRefund, uint256 providerRelease);
    event ResolutionCancelled(uint256 indexed agreementId, address indexed cancelledBy);
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
        owner = msg.sender;
        defaultToken = _defaultToken;
        enforceTokenAllowlist = _enforceAllowlist;
        if (_defaultToken != address(0)) {
            allowedTokens[_defaultToken] = true;
            emit TokenAllowlistUpdated(_defaultToken, true);
        }
    }

    /**
     * @notice Admin function to configure allowed tokens
     */
    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        allowedTokens[token] = allowed;
        emit TokenAllowlistUpdated(token, allowed);
    }

    /**
     * @notice Check whether a token is allowed for agreement creation
     */
    function isTokenAllowed(address token) public view returns (bool) {
        if (!enforceTokenAllowlist) {
            return token != address(0) && token.code.length > 0;
        }
        return allowedTokens[token];
    }

    /**
     * @notice Create a new milestone escrow agreement
     * @param provider Address of the freelancer/contractor
     * @param token ERC-20 token address (e.g. MUSD)
     * @param milestoneAmounts Array of individual milestone payout amounts
     * @param termsHash Hash of the agreed specifications/terms
     */
    function createAgreement(
        address provider,
        address token,
        uint256[] calldata milestoneAmounts,
        bytes32 termsHash
    ) external returns (uint256 agreementId) {
        if (provider == address(0) || provider == msg.sender) revert InvalidAddress();
        if (!isTokenAllowed(token)) revert TokenNotAllowed();
        if (milestoneAmounts.length == 0 || milestoneAmounts.length > 50) revert InvalidMilestones();

        uint256 total = 0;
        agreementId = nextAgreementId++;

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            uint256 amount = milestoneAmounts[i];
            if (amount == 0) revert InvalidMilestones();
            total += amount;

            _milestones[agreementId][i] = Milestone({
                amount: amount,
                state: MilestoneState.Pending,
                submissionHash: bytes32(0),
                rejectionReasonHash: bytes32(0)
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

        agreement.state = AgreementState.Funded;
        agreement.fundedAt = uint64(block.timestamp);

        emit AgreementFunded(agreementId, msg.sender, agreement.totalAmount);

        // Safe transfer tokens from client to this escrow contract
        IERC20(agreement.token).safeTransferFrom(msg.sender, address(this), agreement.totalAmount);
    }

    /**
     * @notice Provider submits milestone deliverable evidence
     * @param agreementId Agreement ID
     * @param milestoneIndex Index of milestone (0-indexed)
     * @param submissionHash Hash/URI reference to deliverable evidence
     */
    function submitMilestone(
        uint256 agreementId,
        uint256 milestoneIndex,
        bytes32 submissionHash
    ) external {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.provider) revert NotProvider();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }
        if (milestoneIndex >= agreement.milestoneCount) revert MilestoneOutOfBounds();

        Milestone storage milestone = _milestones[agreementId][milestoneIndex];
        if (
            milestone.state != MilestoneState.Pending &&
            milestone.state != MilestoneState.Rejected
        ) {
            revert MilestoneNotPendingOrRejected();
        }

        milestone.state = MilestoneState.Submitted;
        milestone.submissionHash = submissionHash;

        emit MilestoneSubmitted(agreementId, milestoneIndex, submissionHash);
    }

    /**
     * @notice Client approves submitted milestone and releases payment to provider
     * @param agreementId Agreement ID
     * @param milestoneIndex Index of milestone (0-indexed)
     */
    function approveMilestone(
        uint256 agreementId,
        uint256 milestoneIndex
    ) external nonReentrant {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client) revert NotClient();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }
        if (milestoneIndex >= agreement.milestoneCount) revert MilestoneOutOfBounds();

        Milestone storage milestone = _milestones[agreementId][milestoneIndex];
        if (milestone.state != MilestoneState.Submitted) revert MilestoneNotSubmitted();

        milestone.state = MilestoneState.Approved;
        uint256 amount = milestone.amount;
        agreement.releasedAmount += amount;

        // Invariant check: released + refunded <= totalAmount
        require(
            agreement.releasedAmount + agreement.refundedAmount <= agreement.totalAmount,
            "Invariant: exceeded total"
        );

        emit MilestoneApproved(agreementId, milestoneIndex, amount);

        // Check if all milestones have now been approved
        bool allApproved = true;
        for (uint256 i = 0; i < agreement.milestoneCount; i++) {
            if (_milestones[agreementId][i].state != MilestoneState.Approved) {
                allApproved = false;
                break;
            }
        }

        if (allApproved) {
            agreement.state = AgreementState.Completed;
            agreement.completedAt = uint64(block.timestamp);
            emit AgreementCompleted(agreementId);
        }

        // Transfer funds directly to provider
        IERC20(agreement.token).safeTransfer(agreement.provider, amount);
    }

    /**
     * @notice Client rejects submitted milestone with a clear reason hash
     * @param agreementId Agreement ID
     * @param milestoneIndex Index of milestone (0-indexed)
     * @param reasonHash Hash/URI describing why the submission was rejected
     */
    function rejectMilestone(
        uint256 agreementId,
        uint256 milestoneIndex,
        bytes32 reasonHash
    ) external {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client) revert NotClient();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }
        if (milestoneIndex >= agreement.milestoneCount) revert MilestoneOutOfBounds();

        Milestone storage milestone = _milestones[agreementId][milestoneIndex];
        if (milestone.state != MilestoneState.Submitted) revert MilestoneNotSubmitted();

        milestone.state = MilestoneState.Rejected;
        milestone.rejectionReasonHash = reasonHash;

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
        emit AgreementCancelled(agreementId, msg.sender, 0);
    }

    /**
     * @notice Propose a mutual resolution for a funded agreement.
     * Either client or provider specifies how the remaining balance should be split.
     * @param agreementId Agreement ID
     * @param clientRefundAmount Amount to return to client
     * @param providerReleaseAmount Amount to release to provider
     */
    function proposeResolution(
        uint256 agreementId,
        uint256 clientRefundAmount,
        uint256 providerReleaseAmount
    ) external {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client && msg.sender != agreement.provider) revert NotParty();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }

        uint256 remaining = getRemainingBalance(agreementId);
        if (clientRefundAmount + providerReleaseAmount != remaining) {
            revert InvalidResolutionAmounts();
        }

        _resolutionProposals[agreementId] = ResolutionProposal({
            exists: true,
            proposedBy: msg.sender,
            clientRefundAmount: clientRefundAmount,
            providerReleaseAmount: providerReleaseAmount
        });

        emit ResolutionProposed(agreementId, msg.sender, clientRefundAmount, providerReleaseAmount);
    }

    /**
     * @notice Accept the counterparty's pending resolution proposal.
     * Executes the agreed split and marks the agreement as Cancelled/Resolved.
     */
    function acceptResolutionProposal(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = _agreements[agreementId];
        if (agreement.id == 0) revert AgreementDoesNotExist();
        if (msg.sender != agreement.client && msg.sender != agreement.provider) revert NotParty();
        if (agreement.state != AgreementState.Funded) {
            revert InvalidAgreementState(AgreementState.Funded, agreement.state);
        }

        ResolutionProposal memory proposal = _resolutionProposals[agreementId];
        if (!proposal.exists) revert NoActiveResolutionProposal();
        if (msg.sender == proposal.proposedBy) revert CannotAcceptOwnProposal();

        uint256 remaining = getRemainingBalance(agreementId);
        if (proposal.clientRefundAmount + proposal.providerReleaseAmount != remaining) {
            revert InvalidResolutionAmounts();
        }

        delete _resolutionProposals[agreementId];

        agreement.refundedAmount += proposal.clientRefundAmount;
        agreement.releasedAmount += proposal.providerReleaseAmount;
        agreement.state = AgreementState.Cancelled;

        emit ResolutionAccepted(agreementId, proposal.clientRefundAmount, proposal.providerReleaseAmount);
        emit AgreementCancelled(agreementId, msg.sender, proposal.clientRefundAmount);

        // Safe transfers
        if (proposal.providerReleaseAmount > 0) {
            IERC20(agreement.token).safeTransfer(agreement.provider, proposal.providerReleaseAmount);
        }
        if (proposal.clientRefundAmount > 0) {
            IERC20(agreement.token).safeTransfer(agreement.client, proposal.clientRefundAmount);
        }
    }

    /**
     * @notice Cancel a resolution proposal previously submitted by caller
     */
    function cancelResolutionProposal(uint256 agreementId) external {
        ResolutionProposal memory proposal = _resolutionProposals[agreementId];
        if (!proposal.exists) revert NoActiveResolutionProposal();
        if (msg.sender != proposal.proposedBy) revert NotParty();

        delete _resolutionProposals[agreementId];
        emit ResolutionCancelled(agreementId, msg.sender);
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

