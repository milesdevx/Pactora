// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PactoraEscrow} from "../src/PactoraEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MaliciousERC20} from "./mocks/MaliciousERC20.sol";
import {FeeOnTransferERC20} from "./mocks/FeeOnTransferERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DeployPactoraEscrow} from "../script/DeployPactoraEscrow.s.sol";

contract PactoraEscrowTest is Test {
    PactoraEscrow public escrow;
    MockERC20 public musd;

    address public client = address(0x1111);
    address public provider = address(0x2222);
    address public stranger = address(0x3333);

    bytes32 public constant SAMPLE_TERMS_HASH = keccak256("Pactora Milestone Agreement v1");
    bytes32 public constant SUBMISSION_HASH_1 = keccak256("Milestone 1 Deliverable: Figma Design & Specs");
    bytes32 public constant SUBMISSION_HASH_2 = keccak256("Milestone 2 Deliverable: Next.js Frontend");
    bytes32 public constant REJECTION_HASH = keccak256("Design missing mobile viewport specifications");

    function setUp() public {
        vm.warp(1_700_000_000);
        musd = new MockERC20("Mezo USD", "MUSD");
        escrow = new PactoraEscrow(address(musd), false);

        // Fund client with 50,000 MUSD
        musd.mint(client, 50_000 * 10 ** 18);

        vm.label(client, "Client");
        vm.label(provider, "Provider");
        vm.label(stranger, "Stranger");
        vm.label(address(escrow), "PactoraEscrow");
        vm.label(address(musd), "MUSD");
    }

    // --- Creation Tests ---

    function test_CreateAgreement_Success() public {
        uint256[] memory milestones = new uint256[](2);
        milestones[0] = 1_000 * 10 ** 18;
        milestones[1] = 2_000 * 10 ** 18;

        vm.prank(client);
        uint256 agreementId = escrow.createAgreement(
            provider, address(musd), milestones, _deadlines(milestones.length), SAMPLE_TERMS_HASH
        );

        assertEq(agreementId, 1);

        PactoraEscrow.Agreement memory ag = escrow.getAgreement(agreementId);
        assertEq(ag.client, client);
        assertEq(ag.provider, provider);
        assertEq(ag.token, address(musd));
        assertEq(ag.totalAmount, 3_000 * 10 ** 18);
        assertEq(uint256(ag.state), uint256(PactoraEscrow.AgreementState.Created));
        assertEq(ag.milestoneCount, 2);

        PactoraEscrow.Milestone[] memory msList = escrow.getMilestones(agreementId);
        assertEq(msList.length, 2);
        assertEq(msList[0].amount, 1_000 * 10 ** 18);
        assertEq(uint256(msList[0].state), uint256(PactoraEscrow.MilestoneState.Pending));
        assertEq(msList[1].amount, 2_000 * 10 ** 18);
    }

    function test_CreateAgreement_IdsIncrementAndEventsUseAssignedIdAndParties() public {
        vm.expectEmit(true, true, true, true, address(escrow));
        emit PactoraEscrow.AgreementCreated(1, client, provider, address(musd), 3_000 ether, SAMPLE_TERMS_HASH);
        uint256 first = _createSampleAgreement();

        vm.prank(client);
        vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
        escrow.createAgreement(client, address(musd), _amounts(1), _deadlines(1), SAMPLE_TERMS_HASH);

        vm.expectEmit(true, true, true, true, address(escrow));
        emit PactoraEscrow.AgreementCreated(2, client, provider, address(musd), 3_000 ether, SAMPLE_TERMS_HASH);
        uint256 second = _createSampleAgreement();

        assertEq(first, 1);
        assertEq(second, 2);
        assertEq(escrow.getAgreement(first).id, first);
        assertEq(escrow.getAgreement(second).id, second);
        assertEq(escrow.nextAgreementId(), 3);
        assertEq(escrow.getAgreementCount(), 2);
    }

    function test_CreateAgreement_Revert_ZeroAddress() public {
        uint256[] memory milestones = new uint256[](1);
        milestones[0] = 500 * 10 ** 18;

        vm.prank(client);
        vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
        escrow.createAgreement(address(0), address(musd), milestones, _deadlines(1), SAMPLE_TERMS_HASH);

        // Cannot create agreement with oneself as provider
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
        escrow.createAgreement(client, address(musd), milestones, _deadlines(1), SAMPLE_TERMS_HASH);
    }

    function test_CreateAgreement_Revert_ZeroMilestoneAmount() public {
        uint256[] memory milestones = new uint256[](2);
        milestones[0] = 1_000 * 10 ** 18;
        milestones[1] = 0; // Invalid zero amount

        vm.prank(client);
        vm.expectRevert(PactoraEscrow.InvalidMilestones.selector);
        escrow.createAgreement(provider, address(musd), milestones, _deadlines(2), SAMPLE_TERMS_HASH);
    }

    // --- Acceptance Tests ---

    function test_AcceptAgreement_Success() public {
        uint256 agreementId = _createSampleAgreement();

        vm.prank(provider);
        escrow.acceptAgreement(agreementId);

        PactoraEscrow.Agreement memory ag = escrow.getAgreement(agreementId);
        assertEq(uint256(ag.state), uint256(PactoraEscrow.AgreementState.Accepted));
    }

    function test_AcceptAgreement_Revert_NotProvider() public {
        uint256 agreementId = _createSampleAgreement();

        vm.prank(stranger);
        vm.expectRevert(PactoraEscrow.NotProvider.selector);
        escrow.acceptAgreement(agreementId);
    }

    // --- Funding Tests ---

    function test_FundAgreement_Success() public {
        uint256 agreementId = _createSampleAgreement();

        vm.prank(provider);
        escrow.acceptAgreement(agreementId);

        vm.startPrank(client);
        musd.approve(address(escrow), 3_000 * 10 ** 18);
        escrow.fundAgreement(agreementId);
        vm.stopPrank();

        PactoraEscrow.Agreement memory ag = escrow.getAgreement(agreementId);
        assertEq(uint256(ag.state), uint256(PactoraEscrow.AgreementState.Funded));
        assertEq(musd.balanceOf(address(escrow)), 3_000 * 10 ** 18);
        assertEq(escrow.getRemainingBalance(agreementId), 3_000 * 10 ** 18);
    }

    function test_FundAgreement_Revert_NotClient() public {
        uint256 agreementId = _createSampleAgreement();

        vm.prank(provider);
        escrow.acceptAgreement(agreementId);

        vm.prank(stranger);
        vm.expectRevert(PactoraEscrow.NotClient.selector);
        escrow.fundAgreement(agreementId);
    }

    function test_FundAgreement_Revert_DoubleFunding() public {
        uint256 agreementId = _createAndFundSampleAgreement();

        vm.startPrank(client);
        musd.approve(address(escrow), 3_000 * 10 ** 18);
        vm.expectRevert(
            abi.encodeWithSelector(
                PactoraEscrow.InvalidAgreementState.selector,
                PactoraEscrow.AgreementState.Accepted,
                PactoraEscrow.AgreementState.Funded
            )
        );
        escrow.fundAgreement(agreementId);
        vm.stopPrank();
    }

    // --- Submission and Approval Lifecycle ---

    function test_SubmitMilestone_Success() public {
        uint256 agreementId = _createAndFundSampleAgreement();

        vm.prank(provider);
        escrow.submitMilestone(agreementId, 0, SUBMISSION_HASH_1);

        PactoraEscrow.Milestone memory ms = escrow.getMilestone(agreementId, 0);
        assertEq(uint256(ms.state), uint256(PactoraEscrow.MilestoneState.Submitted));
        assertEq(ms.submissionHash, SUBMISSION_HASH_1);
    }

    function test_SubmitMilestone_Revert_NotProvider() public {
        uint256 agreementId = _createAndFundSampleAgreement();

        vm.prank(client);
        vm.expectRevert(PactoraEscrow.NotProvider.selector);
        escrow.submitMilestone(agreementId, 0, SUBMISSION_HASH_1);
    }

    function test_ApproveMilestone_Success() public {
        uint256 agreementId = _createAndFundSampleAgreement();

        vm.prank(provider);
        escrow.submitMilestone(agreementId, 0, SUBMISSION_HASH_1);

        uint256 providerPreBalance = musd.balanceOf(provider);

        vm.prank(client);
        escrow.approveMilestone(agreementId, 0);

        PactoraEscrow.Milestone memory ms = escrow.getMilestone(agreementId, 0);
        assertEq(uint256(ms.state), uint256(PactoraEscrow.MilestoneState.Approved));

        assertEq(musd.balanceOf(provider), providerPreBalance + 1_000 * 10 ** 18);
        assertEq(escrow.getRemainingBalance(agreementId), 2_000 * 10 ** 18);
    }

    function test_ApproveMilestone_Revert_NotSubmitted() public {
        uint256 agreementId = _createAndFundSampleAgreement();

        // Client attempts to approve before provider submits
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.MilestoneNotSubmitted.selector);
        escrow.approveMilestone(agreementId, 0);
    }

    function test_ApproveMilestone_Revert_DuplicateApproval() public {
        uint256 agreementId = _createAndFundSampleAgreement();

        vm.prank(provider);
        escrow.submitMilestone(agreementId, 0, SUBMISSION_HASH_1);

        vm.prank(client);
        escrow.approveMilestone(agreementId, 0);

        // Attempt second approval
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.MilestoneNotSubmitted.selector);
        escrow.approveMilestone(agreementId, 0);
    }

    function test_RejectAndResubmitMilestone_Success() public {
        uint256 agreementId = _createAndFundSampleAgreement();

        // 1. Submit
        vm.prank(provider);
        escrow.submitMilestone(agreementId, 0, SUBMISSION_HASH_1);

        // 2. Reject with reason
        vm.prank(client);
        escrow.rejectMilestone(agreementId, 0, REJECTION_HASH);

        PactoraEscrow.Milestone memory ms = escrow.getMilestone(agreementId, 0);
        assertEq(uint256(ms.state), uint256(PactoraEscrow.MilestoneState.Rejected));
        assertEq(ms.rejectionReasonHash, REJECTION_HASH);

        // 3. Provider resubmits revised work
        bytes32 revisedHash = keccak256("Milestone 1 Revised with mobile screens");
        vm.prank(provider);
        escrow.submitMilestone(agreementId, 0, revisedHash);

        // 4. Client approves revised submission
        vm.prank(client);
        escrow.approveMilestone(agreementId, 0);

        ms = escrow.getMilestone(agreementId, 0);
        assertEq(uint256(ms.state), uint256(PactoraEscrow.MilestoneState.Approved));
    }

    function test_CompleteAgreement_AllMilestonesApproved() public {
        uint256 agreementId = _createAndFundSampleAgreement();

        // Milestone 0
        vm.prank(provider);
        escrow.submitMilestone(agreementId, 0, SUBMISSION_HASH_1);
        vm.prank(client);
        escrow.approveMilestone(agreementId, 0);

        // Milestone 1
        vm.prank(provider);
        escrow.submitMilestone(agreementId, 1, SUBMISSION_HASH_2);
        vm.prank(client);
        escrow.approveMilestone(agreementId, 1);

        PactoraEscrow.Agreement memory ag = escrow.getAgreement(agreementId);
        assertEq(uint256(ag.state), uint256(PactoraEscrow.AgreementState.Completed));
        assertEq(escrow.getRemainingBalance(agreementId), 0);
        assertEq(musd.balanceOf(provider), 3_000 * 10 ** 18);
    }

    // --- Mutual Consent Dispute Resolution ---

    function test_MutualConsentResolution_Success() public {
        uint256 agreementId = _createAndFundSampleAgreement();

        // Complete Milestone 1 (1,000 MUSD)
        vm.prank(provider);
        escrow.submitMilestone(agreementId, 0, SUBMISSION_HASH_1);
        vm.prank(client);
        escrow.approveMilestone(agreementId, 0);

        // Remaining balance is 2,000 MUSD.
        // Client proposes a resolution: refund 1,200 to client, release 800 to provider.
        uint256 clientRefund = 1_200 * 10 ** 18;
        uint256 providerRelease = 800 * 10 ** 18;

        vm.prank(client);
        escrow.proposeResolution(agreementId, clientRefund, providerRelease);

        PactoraEscrow.ResolutionProposal memory prop = escrow.getResolutionProposal(agreementId);
        assertTrue(prop.exists);
        assertEq(prop.proposedBy, client);
        assertEq(prop.clientRefundAmount, clientRefund);
        assertEq(prop.providerReleaseAmount, providerRelease);

        // Client cannot accept own proposal
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.CannotAcceptOwnProposal.selector);
        escrow.acceptResolutionProposal(agreementId, prop.proposalHash);

        // Provider accepts proposal
        uint256 clientPre = musd.balanceOf(client);
        uint256 providerPre = musd.balanceOf(provider);

        vm.prank(provider);
        escrow.acceptResolutionProposal(agreementId, prop.proposalHash);

        assertEq(musd.balanceOf(client), clientPre + clientRefund);
        assertEq(musd.balanceOf(provider), providerPre + providerRelease);

        PactoraEscrow.Agreement memory ag = escrow.getAgreement(agreementId);
        assertEq(uint256(ag.state), uint256(PactoraEscrow.AgreementState.Cancelled));
        assertEq(escrow.getRemainingBalance(agreementId), 0);
    }

    // --- Unfunded Cancellation ---

    function test_CancelUnfundedAgreement_Success() public {
        uint256 agreementId = _createSampleAgreement();

        // Client cancels agreement before acceptance
        vm.prank(client);
        escrow.cancelUnfundedAgreement(agreementId);

        PactoraEscrow.Agreement memory ag = escrow.getAgreement(agreementId);
        assertEq(uint256(ag.state), uint256(PactoraEscrow.AgreementState.Cancelled));
    }

    // --- Reentrancy Attack Defense ---

    function test_ReentrancyAttack_Reverts() public {
        MaliciousERC20 maliciousToken = new MaliciousERC20();
        PactoraEscrow freshEscrow = new PactoraEscrow(address(maliciousToken), false);

        uint256[] memory milestones = new uint256[](1);
        milestones[0] = 500 * 10 ** 18;

        // Client creates agreement with malicious token
        vm.prank(client);
        uint256 agId = freshEscrow.createAgreement(
            provider, address(maliciousToken), milestones, _deadlines(1), SAMPLE_TERMS_HASH
        );

        // Provider accepts
        vm.prank(provider);
        freshEscrow.acceptAgreement(agId);

        // Client funds
        maliciousToken.approve(address(freshEscrow), 500 * 10 ** 18);
        maliciousToken.transfer(client, 500 * 10 ** 18);
        vm.prank(client);
        maliciousToken.approve(address(freshEscrow), 500 * 10 ** 18);
        vm.prank(client);
        freshEscrow.fundAgreement(agId);

        // Provider submits
        vm.prank(provider);
        freshEscrow.submitMilestone(agId, 0, SUBMISSION_HASH_1);

        // Arm the token to attempt reentrant approveMilestone during transfer to provider
        maliciousToken.setEscrowTarget(freshEscrow, agId);

        // Reentrant call should fail with ReentrancyGuardReentrantCall
        vm.prank(client);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        freshEscrow.approveMilestone(agId, 0);
    }

    // --- Fuzz Test ---

    function testFuzz_MilestoneAmountsInvariant(uint96 a, uint96 b) public {
        vm.assume(a > 0 && a <= 1_000_000 * 10 ** 18);
        vm.assume(b > 0 && b <= 1_000_000 * 10 ** 18);

        uint256[] memory milestones = new uint256[](2);
        milestones[0] = a;
        milestones[1] = b;
        uint256 total = uint256(a) + uint256(b);

        musd.mint(client, total);

        vm.prank(client);
        uint256 agreementId =
            escrow.createAgreement(provider, address(musd), milestones, _deadlines(2), SAMPLE_TERMS_HASH);

        vm.prank(provider);
        escrow.acceptAgreement(agreementId);

        vm.startPrank(client);
        musd.approve(address(escrow), total);
        escrow.fundAgreement(agreementId);
        vm.stopPrank();

        assertEq(escrow.getRemainingBalance(agreementId), total);

        // Submit and approve milestone 0
        vm.prank(provider);
        escrow.submitMilestone(agreementId, 0, SUBMISSION_HASH_1);
        vm.prank(client);
        escrow.approveMilestone(agreementId, 0);

        assertEq(escrow.getRemainingBalance(agreementId), b);
    }

    // --- V2 Validation and Authorization ---

    function test_VersionConstantsAndPreservedStateIndices() public view {
        assertEq(escrow.VERSION(), 2);
        assertEq(escrow.REVIEW_WINDOW(), 7 days);
        assertEq(uint256(PactoraEscrow.MilestoneState.Pending), 0);
        assertEq(uint256(PactoraEscrow.MilestoneState.Submitted), 1);
        assertEq(uint256(PactoraEscrow.MilestoneState.Approved), 2);
        assertEq(uint256(PactoraEscrow.MilestoneState.Rejected), 3);
        assertEq(uint256(PactoraEscrow.MilestoneState.Refunded), 4);
        assertEq(escrow.owner(), address(this));
        assertEq(escrow.defaultToken(), address(musd));
    }

    function test_Constructor_RejectsZeroAndEOAInBothModes() public {
        for (uint256 i = 0; i < 2; i++) {
            vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
            new PactoraEscrow(address(0), i == 1);
            vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
            new PactoraEscrow(stranger, i == 1);
        }
    }

    function test_Tokens_ValidateAddressesWithAndWithoutAllowlist() public {
        MockERC20 custom = new MockERC20("Custom", "CUSTOM");
        for (uint256 i = 0; i < 2; i++) {
            PactoraEscrow target = new PactoraEscrow(address(musd), i == 1);
            assertTrue(target.isTokenAllowed(address(musd)));
            assertFalse(target.isTokenAllowed(address(0)));
            assertFalse(target.isTokenAllowed(stranger));
            assertEq(target.isTokenAllowed(address(custom)), i == 0);

            vm.prank(client);
            vm.expectRevert(PactoraEscrow.TokenNotAllowed.selector);
            target.createAgreement(provider, address(0), _amounts(1), _deadlines(1), SAMPLE_TERMS_HASH);
            vm.prank(client);
            vm.expectRevert(PactoraEscrow.TokenNotAllowed.selector);
            target.createAgreement(provider, stranger, _amounts(1), _deadlines(1), SAMPLE_TERMS_HASH);

            if (i == 1) {
                vm.prank(client);
                vm.expectRevert(PactoraEscrow.TokenNotAllowed.selector);
                target.createAgreement(provider, address(custom), _amounts(1), _deadlines(1), SAMPLE_TERMS_HASH);
            }
            target.setTokenAllowed(address(custom), true);
            assertTrue(target.isTokenAllowed(address(custom)));
            vm.prank(client);
            target.createAgreement(provider, address(custom), _amounts(1), _deadlines(1), SAMPLE_TERMS_HASH);

            vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
            target.setTokenAllowed(address(0), true);
            vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
            target.setTokenAllowed(address(0), false);
            vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
            target.setTokenAllowed(stranger, true);
            target.setTokenAllowed(stranger, false);
            assertFalse(target.allowedTokens(stranger));
        }
    }

    function test_Allowlist_RejectsPreviouslyAllowedAddressWithoutCode() public {
        PactoraEscrow target = new PactoraEscrow(address(musd), true);
        MockERC20 custom = new MockERC20("Custom", "CUSTOM");
        target.setTokenAllowed(address(custom), true);
        vm.etch(address(custom), hex"");
        assertTrue(target.allowedTokens(address(custom)));
        assertFalse(target.isTokenAllowed(address(custom)));
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.TokenNotAllowed.selector);
        target.createAgreement(provider, address(custom), _amounts(1), _deadlines(1), SAMPLE_TERMS_HASH);
        target.setTokenAllowed(address(custom), false);
        assertFalse(target.allowedTokens(address(custom)));
    }

    function test_Allowlist_OnlyOwnerAndEventArguments() public {
        MockERC20 custom = new MockERC20("Custom", "CUSTOM");
        vm.prank(stranger);
        vm.expectRevert(PactoraEscrow.NotOwner.selector);
        escrow.setTokenAllowed(address(custom), true);
        vm.expectEmit(true, false, false, true, address(escrow));
        emit PactoraEscrow.TokenAllowlistUpdated(address(custom), true);
        escrow.setTokenAllowed(address(custom), true);
        vm.expectEmit(true, false, false, true, address(escrow));
        emit PactoraEscrow.TokenAllowlistUpdated(address(custom), false);
        escrow.setTokenAllowed(address(custom), false);
    }

    function test_Create_EmptyTooManyAndMismatchedArraysRevert() public {
        vm.startPrank(client);
        vm.expectRevert(PactoraEscrow.InvalidMilestones.selector);
        escrow.createAgreement(provider, address(musd), _amounts(0), _deadlines(0), SAMPLE_TERMS_HASH);
        vm.expectRevert(PactoraEscrow.InvalidMilestones.selector);
        escrow.createAgreement(provider, address(musd), _amounts(51), _deadlines(51), SAMPLE_TERMS_HASH);
        vm.expectRevert(PactoraEscrow.InvalidMilestones.selector);
        escrow.createAgreement(provider, address(musd), _amounts(2), _deadlines(1), SAMPLE_TERMS_HASH);
        vm.expectRevert(PactoraEscrow.InvalidMilestones.selector);
        escrow.createAgreement(provider, address(musd), _amounts(1), _deadlines(2), SAMPLE_TERMS_HASH);
        vm.stopPrank();
        assertEq(escrow.nextAgreementId(), 1);
        assertEq(escrow.getAgreementCount(), 0);
    }

    function test_Create_FiftyMilestonesAndImmutableDeadlines() public {
        uint64[] memory deadlines = _deadlines(50);
        vm.prank(client);
        uint256 id = escrow.createAgreement(provider, address(musd), _amounts(50), deadlines, SAMPLE_TERMS_HASH);
        vm.prank(provider);
        escrow.acceptAgreement(id);
        PactoraEscrow.Milestone[] memory milestones = escrow.getMilestones(id);
        assertEq(milestones.length, 50);
        assertEq(escrow.getAgreement(id).termsHash, SAMPLE_TERMS_HASH);
        assertEq(escrow.getAgreementCount(), 1);
        for (uint256 i = 0; i < 50; i++) {
            assertEq(milestones[i].deliveryDeadline, deadlines[i]);
            assertEq(milestones[i].submittedAt, 0);
            assertEq(milestones[i].rejectedAt, 0);
        }
    }

    function test_Create_DeadlinesMustBeStrictlyFuture() public {
        uint64[] memory deadlines = _deadlines(2);
        deadlines[1] = uint64(vm.getBlockTimestamp());
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.InvalidDeliveryDeadline.selector);
        escrow.createAgreement(provider, address(musd), _amounts(2), deadlines, SAMPLE_TERMS_HASH);
        deadlines[1]--;
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.InvalidDeliveryDeadline.selector);
        escrow.createAgreement(provider, address(musd), _amounts(2), deadlines, SAMPLE_TERMS_HASH);
        deadlines[1] = uint64(vm.getBlockTimestamp() + 1);
        vm.prank(client);
        uint256 id = escrow.createAgreement(provider, address(musd), _amounts(2), deadlines, SAMPLE_TERMS_HASH);
        assertEq(id, 1);
        assertEq(escrow.getMilestone(id, 1).deliveryDeadline, vm.getBlockTimestamp() + 1);
    }

    function test_MissingAgreement_AllMutationGuards() public {
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.acceptAgreement(999);
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.fundAgreement(999);
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.submitMilestone(999, 0, SUBMISSION_HASH_1);
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.approveMilestone(999, 0);
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.rejectMilestone(999, 0, REJECTION_HASH);
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.claimAfterTimeout(999, 0);
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.refundNoShow(999, 0);
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.cancelUnfundedAgreement(999);
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.proposeResolution(999, 0, 0);
        vm.expectRevert(PactoraEscrow.AgreementDoesNotExist.selector);
        escrow.acceptResolutionProposal(999, bytes32(0));
        vm.expectRevert(PactoraEscrow.NoActiveResolutionProposal.selector);
        escrow.cancelResolutionProposal(999);
        assertEq(escrow.getRemainingBalance(999), 0);
        assertEq(escrow.getAgreement(999).id, 0);
        assertEq(escrow.getMilestones(999).length, 0);
    }

    function test_Strangers_CannotMutateAgreementOrProposal() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.startPrank(stranger);
        vm.expectRevert(PactoraEscrow.NotClient.selector);
        escrow.fundAgreement(id);
        vm.expectRevert(PactoraEscrow.NotClient.selector);
        escrow.approveMilestone(id, 0);
        vm.expectRevert(PactoraEscrow.NotClient.selector);
        escrow.rejectMilestone(id, 0, REJECTION_HASH);
        vm.expectRevert(PactoraEscrow.NotClient.selector);
        escrow.refundNoShow(id, 0);
        vm.expectRevert(PactoraEscrow.NotProvider.selector);
        escrow.acceptAgreement(id);
        vm.expectRevert(PactoraEscrow.NotProvider.selector);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.expectRevert(PactoraEscrow.NotProvider.selector);
        escrow.claimAfterTimeout(id, 0);
        vm.expectRevert(PactoraEscrow.NotParty.selector);
        escrow.cancelUnfundedAgreement(id);
        vm.expectRevert(PactoraEscrow.NotParty.selector);
        escrow.proposeResolution(id, 0, 3_000 ether);
        vm.expectRevert(PactoraEscrow.NotParty.selector);
        escrow.acceptResolutionProposal(id, bytes32(0));
        vm.stopPrank();
        vm.prank(client);
        escrow.proposeResolution(id, 1_000 ether, 2_000 ether);
        vm.prank(stranger);
        vm.expectRevert(PactoraEscrow.NotParty.selector);
        escrow.cancelResolutionProposal(id);
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.NotParty.selector);
        escrow.cancelResolutionProposal(id);
    }

    function test_UnfundedAgreement_RejectsMoneyAndMilestoneActions() public {
        uint256 id = _createSampleAgreement();
        bytes memory needsFunded =
            _stateError(PactoraEscrow.AgreementState.Funded, PactoraEscrow.AgreementState.Created);
        vm.startPrank(client);
        vm.expectRevert(_stateError(PactoraEscrow.AgreementState.Accepted, PactoraEscrow.AgreementState.Created));
        escrow.fundAgreement(id);
        vm.expectRevert(needsFunded);
        escrow.approveMilestone(id, 0);
        vm.expectRevert(needsFunded);
        escrow.rejectMilestone(id, 0, REJECTION_HASH);
        vm.expectRevert(needsFunded);
        escrow.refundNoShow(id, 0);
        vm.expectRevert(needsFunded);
        escrow.proposeResolution(id, 0, 3_000 ether);
        vm.expectRevert(needsFunded);
        escrow.acceptResolutionProposal(id, bytes32(0));
        vm.stopPrank();
        vm.startPrank(provider);
        vm.expectRevert(needsFunded);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.expectRevert(needsFunded);
        escrow.claimAfterTimeout(id, 0);
        escrow.acceptAgreement(id);
        vm.expectRevert(_stateError(PactoraEscrow.AgreementState.Created, PactoraEscrow.AgreementState.Accepted));
        escrow.acceptAgreement(id);
        vm.stopPrank();
    }

    function test_OutOfBounds_AllMilestoneActions() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.startPrank(provider);
        vm.expectRevert(PactoraEscrow.MilestoneOutOfBounds.selector);
        escrow.submitMilestone(id, 2, SUBMISSION_HASH_1);
        vm.expectRevert(PactoraEscrow.MilestoneOutOfBounds.selector);
        escrow.claimAfterTimeout(id, 2);
        vm.stopPrank();
        vm.startPrank(client);
        vm.expectRevert(PactoraEscrow.MilestoneOutOfBounds.selector);
        escrow.approveMilestone(id, 2);
        vm.expectRevert(PactoraEscrow.MilestoneOutOfBounds.selector);
        escrow.rejectMilestone(id, 2, REJECTION_HASH);
        vm.expectRevert(PactoraEscrow.MilestoneOutOfBounds.selector);
        escrow.refundNoShow(id, 2);
        vm.stopPrank();
    }

    function test_UnfundedCancellation_EitherPartyAndCompletedAt() public {
        for (uint256 i = 0; i < 2; i++) {
            uint256 id = _createSampleAgreement();
            vm.prank(provider);
            escrow.acceptAgreement(id);
            vm.prank(i == 0 ? client : provider);
            escrow.cancelUnfundedAgreement(id);
            assertEq(escrow.getAgreement(id).completedAt, vm.getBlockTimestamp());
            assertEq(uint256(escrow.getAgreement(id).state), uint256(PactoraEscrow.AgreementState.Cancelled));
        }
        uint256 funded = _createAndFundSampleAgreement();
        vm.prank(client);
        vm.expectRevert(_stateError(PactoraEscrow.AgreementState.Created, PactoraEscrow.AgreementState.Funded));
        escrow.cancelUnfundedAgreement(funded);
    }

    // --- V2 Resolution Consent ---

    function test_Resolution_ReplacementCannotFrontRunReviewedAcceptance() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.prank(client);
        escrow.proposeResolution(id, 1_200 ether, 1_800 ether);
        bytes32 reviewed = escrow.getResolutionProposal(id).proposalHash;
        vm.prank(client);
        escrow.proposeResolution(id, 3_000 ether, 0);
        bytes32 replacement = escrow.getResolutionProposal(id).proposalHash;
        assertNotEq(reviewed, replacement);
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.ProposalHashMismatch.selector);
        escrow.acceptResolutionProposal(id, reviewed);
        assertEq(escrow.getRemainingBalance(id), 3_000 ether);
        assertEq(musd.balanceOf(provider), 0);
        assertEq(escrow.getResolutionProposal(id).proposalHash, replacement);
        vm.prank(provider);
        escrow.acceptResolutionProposal(id, replacement);
        assertEq(escrow.getAgreement(id).refundedAmount, 3_000 ether);
    }

    function test_Resolution_CancelReproposeIdenticalSplitCannotReuseConsent() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.prank(provider);
        escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
        bytes32 reviewed = escrow.getResolutionProposal(id).proposalHash;
        vm.prank(provider);
        escrow.cancelResolutionProposal(id);
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.NoActiveResolutionProposal.selector);
        escrow.acceptResolutionProposal(id, reviewed);
        vm.prank(provider);
        escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
        bytes32 current = escrow.getResolutionProposal(id).proposalHash;
        assertNotEq(reviewed, current);
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.ProposalHashMismatch.selector);
        escrow.acceptResolutionProposal(id, reviewed);
        vm.prank(client);
        escrow.acceptResolutionProposal(id, current);
        assertFalse(escrow.getResolutionProposal(id).exists);
        assertEq(escrow.getAgreement(id).completedAt, vm.getBlockTimestamp());
    }

    function test_Resolution_AcceptanceFirstMakesReplacementAndDoubleAcceptanceInvalid() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.prank(client);
        escrow.proposeResolution(id, 0, 3_000 ether);
        bytes32 reviewed = escrow.getResolutionProposal(id).proposalHash;
        vm.prank(provider);
        escrow.acceptResolutionProposal(id, reviewed);
        assertEq(uint256(escrow.getAgreement(id).state), uint256(PactoraEscrow.AgreementState.Completed));
        vm.prank(client);
        vm.expectRevert(_stateError(PactoraEscrow.AgreementState.Funded, PactoraEscrow.AgreementState.Completed));
        escrow.proposeResolution(id, 3_000 ether, 0);
        vm.prank(provider);
        vm.expectRevert(_stateError(PactoraEscrow.AgreementState.Funded, PactoraEscrow.AgreementState.Completed));
        escrow.acceptResolutionProposal(id, reviewed);
        assertEq(musd.balanceOf(provider), 3_000 ether);
    }

    function test_Resolution_HashDomainAndEventArguments() public {
        uint256 id = _createAndFundSampleAgreement();
        bytes32 first = _proposalHash(id, 1, client, 1_200 ether, 1_800 ether);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.ResolutionProposed(id, client, 1_200 ether, 1_800 ether, first);
        vm.prank(client);
        escrow.proposeResolution(id, 1_200 ether, 1_800 ether);
        assertEq(escrow.getResolutionProposal(id).proposalHash, first);

        bytes32 second = _proposalHash(id, 2, provider, 1_200 ether, 1_800 ether);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.ResolutionCancelled(id, provider, first);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.ResolutionProposed(id, provider, 1_200 ether, 1_800 ether, second);
        vm.prank(provider);
        escrow.proposeResolution(id, 1_200 ether, 1_800 ether);
        assertEq(escrow.getResolutionProposal(id).proposalHash, second);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.ResolutionCancelled(id, provider, second);
        vm.prank(provider);
        escrow.cancelResolutionProposal(id);
        bytes32 third = _proposalHash(id, 3, provider, 1_200 ether, 1_800 ether);
        vm.prank(provider);
        escrow.proposeResolution(id, 1_200 ether, 1_800 ether);
        assertEq(escrow.getResolutionProposal(id).proposalHash, third);

        vm.expectEmit(true, false, false, true, address(escrow));
        emit PactoraEscrow.ResolutionAccepted(id, 1_200 ether, 1_800 ether, third);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.AgreementCancelled(id, client, 1_200 ether);
        vm.prank(client);
        escrow.acceptResolutionProposal(id, third);
    }

    function test_Resolution_RejectsInvalidAmountsOwnProposalAndWrongHash() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.NoActiveResolutionProposal.selector);
        escrow.acceptResolutionProposal(id, bytes32(0));
        vm.startPrank(client);
        vm.expectRevert(PactoraEscrow.InvalidResolutionAmounts.selector);
        escrow.proposeResolution(id, 1_000 ether, 1_000 ether);
        vm.expectRevert(PactoraEscrow.InvalidResolutionAmounts.selector);
        escrow.proposeResolution(id, type(uint256).max, 1);
        escrow.proposeResolution(id, 1_000 ether, 2_000 ether);
        vm.stopPrank();
        bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.CannotAcceptOwnProposal.selector);
        escrow.acceptResolutionProposal(id, hash);
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.ProposalHashMismatch.selector);
        escrow.acceptResolutionProposal(id, bytes32(0));
        assertTrue(escrow.getResolutionProposal(id).exists);
    }

    function test_Resolution_ZeroSidesAndTerminalAccounting() public {
        for (uint256 i = 0; i < 2; i++) {
            uint256 id = _createAndFundSampleAgreement();
            uint256 refund = i == 0 ? 0 : 3_000 ether;
            vm.prank(client);
            escrow.proposeResolution(id, refund, 3_000 ether - refund);
            bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
            vm.prank(provider);
            escrow.acceptResolutionProposal(id, hash);
            PactoraEscrow.Agreement memory agreement = escrow.getAgreement(id);
            assertEq(agreement.releasedAmount + agreement.refundedAmount, agreement.totalAmount);
            assertEq(agreement.refundedAmount, refund);
            assertEq(agreement.completedAt, vm.getBlockTimestamp());
            assertEq(
                uint256(agreement.state),
                uint256(i == 0 ? PactoraEscrow.AgreementState.Completed : PactoraEscrow.AgreementState.Cancelled)
            );
            assertFalse(escrow.getResolutionProposal(id).exists);
        }
        assertEq(musd.balanceOf(address(escrow)), 0);
    }

    function test_Resolution_ApproveBeforeAcceptanceInvalidatesProposal() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.prank(provider);
        escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
        bytes32 stale = escrow.getResolutionProposal(id).proposalHash;
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.ResolutionCancelled(id, client, stale);
        vm.prank(client);
        escrow.approveMilestone(id, 0);
        assertFalse(escrow.getResolutionProposal(id).exists);
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.NoActiveResolutionProposal.selector);
        escrow.acceptResolutionProposal(id, stale);
        vm.prank(provider);
        escrow.proposeResolution(id, 1_000 ether, 1_000 ether);
        assertEq(
            escrow.getResolutionProposal(id).proposalHash, _proposalHash(id, 2, provider, 1_000 ether, 1_000 ether)
        );
    }

    function test_Resolution_AcceptBeforeApprovalPreventsSecondPayout() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.prank(provider);
        escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
        bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
        vm.prank(client);
        escrow.acceptResolutionProposal(id, hash);
        vm.prank(client);
        vm.expectRevert(_stateError(PactoraEscrow.AgreementState.Funded, PactoraEscrow.AgreementState.Cancelled));
        escrow.approveMilestone(id, 0);
        assertEq(musd.balanceOf(provider), 1_500 ether);
    }

    function test_DeploymentScript_RejectsWrongChainBeforeBroadcast() public {
        DeployPactoraEscrow script = new DeployPactoraEscrow();
        assertEq(script.MEZO_TESTNET_CHAIN_ID(), 31611);
        assertEq(script.MEZO_TESTNET_MUSD(), 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503);
        vm.chainId(1);
        vm.expectRevert(DeployPactoraEscrow.NotMezoTestnet.selector);
        script.run();
        vm.chainId(31612);
        vm.expectRevert(DeployPactoraEscrow.NotMezoTestnet.selector);
        script.run();
    }

    // --- V2 Deadlines, Review and Refunds ---

    function test_Fund_AnyExpiredDeadlineRevertsWithoutMovingTokens() public {
        uint64[] memory deadlines = _deadlines(2);
        deadlines[1] = uint64(vm.getBlockTimestamp() + 1 days);
        vm.prank(client);
        uint256 id = escrow.createAgreement(provider, address(musd), _amounts(2), deadlines, SAMPLE_TERMS_HASH);
        vm.prank(provider);
        escrow.acceptAgreement(id);
        vm.prank(client);
        musd.approve(address(escrow), 3_000 ether);
        uint256 balance = musd.balanceOf(client);
        vm.warp(deadlines[1]);
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.DeliveryDeadlinePassed.selector);
        escrow.fundAgreement(id);
        vm.warp(uint256(deadlines[1]) + 1);
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.DeliveryDeadlinePassed.selector);
        escrow.fundAgreement(id);
        assertEq(uint256(escrow.getAgreement(id).state), uint256(PactoraEscrow.AgreementState.Accepted));
        assertEq(escrow.getAgreement(id).fundedAt, 0);
        assertEq(musd.balanceOf(client), balance);
        assertEq(musd.balanceOf(address(escrow)), 0);
        assertEq(musd.allowance(client, address(escrow)), 3_000 ether);
    }

    function test_Fund_OneSecondBeforeDeliveryDeadlineSucceeds() public {
        uint64 deadline = uint64(vm.getBlockTimestamp() + 1 days);
        vm.prank(client);
        uint256 id =
            escrow.createAgreement(provider, address(musd), _amounts(2), _deadlinesAt(2, deadline), SAMPLE_TERMS_HASH);
        vm.prank(provider);
        escrow.acceptAgreement(id);
        vm.warp(uint256(deadline) - 1);
        _fundTokenAgreement(musd, id);
        assertEq(escrow.getAgreement(id).fundedAt, vm.getBlockTimestamp());
        assertEq(escrow.getMilestone(id, 0).deliveryDeadline, deadline);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
    }

    function test_SubmitAndRefund_ExactDeadlineBothTransactionOrders() public {
        for (uint256 order = 0; order < 2; order++) {
            uint64 deadline = uint64(vm.getBlockTimestamp() + 1 days);
            uint256 id = _fundedWithDeadlines(_deadlinesAt(2, deadline));
            vm.warp(deadline);
            if (order == 0) {
                vm.prank(provider);
                vm.expectRevert(PactoraEscrow.DeliveryDeadlinePassed.selector);
                escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            }
            vm.prank(client);
            escrow.refundNoShow(id, 0);
            if (order == 1) {
                vm.prank(provider);
                vm.expectRevert(PactoraEscrow.MilestoneNotPendingOrRejected.selector);
                escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            }
            assertEq(uint256(escrow.getMilestone(id, 0).state), uint256(PactoraEscrow.MilestoneState.Refunded));
            assertEq(escrow.getAgreement(id).refundedAmount, 1_000 ether);
            assertEq(escrow.getRemainingBalance(id), 2_000 ether);
        }
    }

    function test_SubmitAndRefund_BeforeDeadlineBothTransactionOrders() public {
        for (uint256 order = 0; order < 2; order++) {
            uint64 deadline = uint64(vm.getBlockTimestamp() + 1 days);
            uint256 id = _fundedWithDeadlines(_deadlinesAt(2, deadline));
            vm.warp(uint256(deadline) - 1);
            if (order == 0) {
                vm.prank(client);
                vm.expectRevert(PactoraEscrow.DeliveryDeadlineNotReached.selector);
                escrow.refundNoShow(id, 0);
            }
            vm.prank(provider);
            escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            if (order == 1) {
                vm.prank(client);
                vm.expectRevert(PactoraEscrow.MilestoneNotRefundable.selector);
                escrow.refundNoShow(id, 0);
            }
            assertEq(escrow.getMilestone(id, 0).submittedAt, vm.getBlockTimestamp());
            vm.warp(deadline);
            vm.prank(client);
            vm.expectRevert(PactoraEscrow.MilestoneNotRefundable.selector);
            escrow.refundNoShow(id, 0);
        }
    }

    function test_Review_ExactBoundaryRejectAndClaimBothOrders() public {
        for (uint256 order = 0; order < 2; order++) {
            uint256 id = _createAndFundSampleAgreement();
            vm.prank(provider);
            escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            vm.warp(vm.getBlockTimestamp() + 7 days);
            if (order == 0) {
                vm.prank(client);
                vm.expectRevert(PactoraEscrow.ReviewWindowClosed.selector);
                escrow.rejectMilestone(id, 0, REJECTION_HASH);
            }
            uint256 providerBefore = musd.balanceOf(provider);
            vm.prank(provider);
            escrow.claimAfterTimeout(id, 0);
            if (order == 1) {
                vm.prank(client);
                vm.expectRevert(PactoraEscrow.MilestoneNotSubmitted.selector);
                escrow.rejectMilestone(id, 0, REJECTION_HASH);
            }
            assertEq(musd.balanceOf(provider), providerBefore + 1_000 ether);
            assertEq(escrow.getAgreement(id).releasedAmount, 1_000 ether);
            assertEq(uint256(escrow.getMilestone(id, 0).state), uint256(PactoraEscrow.MilestoneState.Approved));
        }
    }

    function test_Review_BeforeBoundaryRejectAndClaimBothOrders() public {
        for (uint256 order = 0; order < 2; order++) {
            uint256 id = _createAndFundSampleAgreement();
            vm.prank(provider);
            escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            vm.warp(vm.getBlockTimestamp() + 7 days - 1);
            if (order == 0) {
                vm.prank(provider);
                vm.expectRevert(PactoraEscrow.ReviewWindowOpen.selector);
                escrow.claimAfterTimeout(id, 0);
            }
            vm.prank(client);
            escrow.rejectMilestone(id, 0, REJECTION_HASH);
            if (order == 1) {
                vm.prank(provider);
                vm.expectRevert(PactoraEscrow.MilestoneNotSubmitted.selector);
                escrow.claimAfterTimeout(id, 0);
            }
            assertEq(escrow.getMilestone(id, 0).rejectedAt, vm.getBlockTimestamp());
            assertEq(escrow.getAgreement(id).releasedAmount, 0);
        }
    }

    function test_ApproveAndTimeout_OnlyOnePaymentInBothOrders() public {
        for (uint256 order = 0; order < 2; order++) {
            uint256 id = _createAndFundSampleAgreement();
            vm.prank(provider);
            escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            vm.warp(vm.getBlockTimestamp() + 7 days);
            uint256 providerBefore = musd.balanceOf(provider);
            if (order == 0) {
                vm.prank(client);
                escrow.approveMilestone(id, 0);
                vm.prank(provider);
                vm.expectRevert(PactoraEscrow.MilestoneNotSubmitted.selector);
                escrow.claimAfterTimeout(id, 0);
            } else {
                vm.prank(provider);
                escrow.claimAfterTimeout(id, 0);
                vm.prank(client);
                vm.expectRevert(PactoraEscrow.MilestoneNotSubmitted.selector);
                escrow.approveMilestone(id, 0);
            }
            assertEq(musd.balanceOf(provider), providerBefore + 1_000 ether);
            assertEq(escrow.getRemainingBalance(id), 2_000 ether);
        }
    }

    function test_TimelySubmission_SurvivesDeliveryDeadlineAndKeepsFullReview() public {
        uint64 deadline = uint64(vm.getBlockTimestamp() + 1 days);
        uint256 id = _fundedWithDeadlines(_deadlinesAt(2, deadline));
        vm.warp(uint256(deadline) - 1);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        uint256 reviewEnd = vm.getBlockTimestamp() + 7 days;
        vm.warp(deadline);
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.MilestoneNotRefundable.selector);
        escrow.refundNoShow(id, 0);
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.ReviewWindowOpen.selector);
        escrow.claimAfterTimeout(id, 0);
        vm.prank(client);
        escrow.refundNoShow(id, 1);
        vm.warp(reviewEnd);
        vm.prank(provider);
        escrow.claimAfterTimeout(id, 0);
        PactoraEscrow.Agreement memory agreement = escrow.getAgreement(id);
        assertEq(agreement.releasedAmount, 1_000 ether);
        assertEq(agreement.refundedAmount, 2_000 ether);
        assertEq(agreement.completedAt, reviewEnd);
        assertEq(uint256(agreement.state), uint256(PactoraEscrow.AgreementState.Cancelled));
    }

    function test_RejectionAfterDelivery_DoesNotAllowImmediateRefund() public {
        uint64 deadline = uint64(vm.getBlockTimestamp() + 1 days);
        uint256 id = _fundedWithDeadlines(_deadlinesAt(2, deadline));
        vm.warp(uint256(deadline) - 1);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.warp(deadline);
        vm.prank(client);
        escrow.rejectMilestone(id, 0, REJECTION_HASH);
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.DeliveryDeadlineNotReached.selector);
        escrow.refundNoShow(id, 0);
        assertEq(escrow.getMilestone(id, 0).rejectedAt, deadline);
        assertEq(escrow.getAgreement(id).refundedAmount, 0);
    }

    function test_Resubmission_GraceOneSecondBeforeExpiryResetsReviewAndRejection() public {
        uint64 deadline = uint64(vm.getBlockTimestamp() + 1 days);
        uint256 id = _fundedWithDeadlines(_deadlinesAt(2, deadline));
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.warp(vm.getBlockTimestamp() + 6 days);
        vm.prank(client);
        escrow.rejectMilestone(id, 0, REJECTION_HASH);
        uint256 graceEnd = vm.getBlockTimestamp() + 7 days;
        vm.warp(graceEnd - 1);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_2);
        PactoraEscrow.Milestone memory milestone = escrow.getMilestone(id, 0);
        assertEq(milestone.deliveryDeadline, deadline);
        assertEq(milestone.submittedAt, graceEnd - 1);
        assertEq(milestone.rejectedAt, 0);
        assertEq(milestone.rejectionReasonHash, bytes32(0));
        assertEq(milestone.submissionHash, SUBMISSION_HASH_2);
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.ReviewWindowOpen.selector);
        escrow.claimAfterTimeout(id, 0);
        vm.warp(graceEnd - 1 + 7 days);
        vm.prank(provider);
        escrow.claimAfterTimeout(id, 0);
        assertEq(escrow.getAgreement(id).releasedAmount, 1_000 ether);
    }

    function test_Resubmission_ExactGraceBoundaryBothTransactionOrders() public {
        for (uint256 order = 0; order < 2; order++) {
            uint64 deadline = uint64(vm.getBlockTimestamp() + 1 days);
            uint256 id = _fundedWithDeadlines(_deadlinesAt(2, deadline));
            vm.prank(provider);
            escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            vm.warp(deadline);
            vm.prank(client);
            escrow.rejectMilestone(id, 0, REJECTION_HASH);
            vm.warp(vm.getBlockTimestamp() + 7 days);
            if (order == 0) {
                vm.prank(provider);
                vm.expectRevert(PactoraEscrow.DeliveryDeadlinePassed.selector);
                escrow.submitMilestone(id, 0, SUBMISSION_HASH_2);
            }
            vm.prank(client);
            escrow.refundNoShow(id, 0);
            if (order == 1) {
                vm.prank(provider);
                vm.expectRevert(PactoraEscrow.MilestoneNotPendingOrRejected.selector);
                escrow.submitMilestone(id, 0, SUBMISSION_HASH_2);
            }
            vm.prank(provider);
            vm.expectRevert(PactoraEscrow.MilestoneNotSubmitted.selector);
            escrow.claimAfterTimeout(id, 0);
            assertEq(escrow.getAgreement(id).refundedAmount, 1_000 ether);
        }
    }

    function test_Resubmission_OriginalDeadlineWinsWhenLaterThanGrace() public {
        uint256 id = _createAndFundSampleAgreement();
        uint64 deadline = escrow.getMilestone(id, 0).deliveryDeadline;
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.prank(client);
        escrow.rejectMilestone(id, 0, REJECTION_HASH);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.DeliveryDeadlineNotReached.selector);
        escrow.refundNoShow(id, 0);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_2);
        assertEq(escrow.getMilestone(id, 0).deliveryDeadline, deadline);
    }

    function test_Resubmission_RepeatedTimelyRejectionsRefreshGrace() public {
        uint64 deadline = uint64(vm.getBlockTimestamp() + 1 days);
        uint256 id = _fundedWithDeadlines(_deadlinesAt(2, deadline));
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        for (uint256 i = 0; i < 3; i++) {
            vm.warp(vm.getBlockTimestamp() + 7 days - 1);
            vm.prank(client);
            escrow.rejectMilestone(id, 0, REJECTION_HASH);
            uint256 graceEnd = vm.getBlockTimestamp() + 7 days;
            vm.warp(graceEnd - 1);
            vm.prank(provider);
            escrow.submitMilestone(id, 0, keccak256(abi.encode(i)));
            assertEq(escrow.getMilestone(id, 0).submittedAt, graceEnd - 1);
        }
        vm.warp(vm.getBlockTimestamp() + 7 days);
        vm.prank(provider);
        escrow.claimAfterTimeout(id, 0);
    }

    function test_RefundAndRelease_AccuratePartialAndClosedTotalsBothOrders() public {
        for (uint256 order = 0; order < 2; order++) {
            uint64 deadline = uint64(vm.getBlockTimestamp() + 1 days);
            uint256 id = _fundedWithDeadlines(_deadlinesAt(2, deadline));
            vm.prank(provider);
            escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            vm.warp(deadline);
            if (order == 0) {
                vm.prank(client);
                escrow.approveMilestone(id, 0);
                assertEq(escrow.getRemainingBalance(id), 2_000 ether);
            }
            vm.prank(client);
            escrow.refundNoShow(id, 1);
            if (order == 1) {
                assertEq(escrow.getRemainingBalance(id), 1_000 ether);
                vm.prank(client);
                escrow.approveMilestone(id, 0);
            }
            PactoraEscrow.Agreement memory agreement = escrow.getAgreement(id);
            assertEq(agreement.releasedAmount, 1_000 ether);
            assertEq(agreement.refundedAmount, 2_000 ether);
            assertEq(agreement.releasedAmount + agreement.refundedAmount, agreement.totalAmount);
            assertEq(uint256(agreement.state), uint256(PactoraEscrow.AgreementState.Cancelled));
            assertEq(agreement.completedAt, deadline);
            assertEq(escrow.getRemainingBalance(id), 0);
        }
        assertEq(musd.balanceOf(address(escrow)), 0);
    }

    function test_RefundAllPending_EventsAndTerminalTimestamp() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.warp(escrow.getMilestone(id, 0).deliveryDeadline);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.MilestoneRefunded(id, 0, 1_000 ether);
        vm.prank(client);
        escrow.refundNoShow(id, 0);
        assertEq(escrow.getRemainingBalance(id), 2_000 ether);
        assertEq(escrow.getAgreement(id).completedAt, 0);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.MilestoneRefunded(id, 1, 2_000 ether);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.AgreementCancelled(id, client, 3_000 ether);
        vm.prank(client);
        escrow.refundNoShow(id, 1);
        assertEq(escrow.getAgreement(id).completedAt, vm.getBlockTimestamp());
        assertEq(escrow.getAgreement(id).refundedAmount, 3_000 ether);
        assertEq(uint256(escrow.getAgreement(id).state), uint256(PactoraEscrow.AgreementState.Cancelled));
    }

    function test_Refund_RejectsSubmittedApprovedRefundedAndDoubleRefund() public {
        uint256 id = _fundedWithDeadlines(_deadlines(4));
        vm.startPrank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        escrow.submitMilestone(id, 1, SUBMISSION_HASH_1);
        escrow.submitMilestone(id, 3, SUBMISSION_HASH_1);
        vm.stopPrank();
        vm.startPrank(client);
        escrow.approveMilestone(id, 1);
        escrow.rejectMilestone(id, 3, REJECTION_HASH);
        vm.stopPrank();
        vm.warp(escrow.getMilestone(id, 2).deliveryDeadline);
        vm.prank(client);
        escrow.refundNoShow(id, 2);
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(client);
            vm.expectRevert(PactoraEscrow.MilestoneNotRefundable.selector);
            escrow.refundNoShow(id, i);
        }
        vm.prank(client);
        escrow.refundNoShow(id, 3);
        assertEq(escrow.getRemainingBalance(id), 1_000 ether);
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.MilestoneNotPendingOrRejected.selector);
        escrow.submitMilestone(id, 1, SUBMISSION_HASH_2);
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.MilestoneNotPendingOrRejected.selector);
        escrow.submitMilestone(id, 2, SUBMISSION_HASH_2);
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.MilestoneNotPendingOrRejected.selector);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_2);
    }

    function test_Timeout_EventsAllReleasedClosureAndProposalInvalidation() public {
        uint256 id = _createAndFundSampleAgreement();
        vm.startPrank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        escrow.submitMilestone(id, 1, SUBMISSION_HASH_2);
        vm.stopPrank();
        vm.prank(client);
        escrow.proposeResolution(id, 1_000 ether, 2_000 ether);
        bytes32 stale = escrow.getResolutionProposal(id).proposalHash;
        vm.warp(vm.getBlockTimestamp() + 7 days);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.MilestoneTimeoutClaimed(id, 0, 1_000 ether);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.ResolutionCancelled(id, provider, stale);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.MilestoneApproved(id, 0, 1_000 ether);
        vm.prank(provider);
        escrow.claimAfterTimeout(id, 0);
        assertFalse(escrow.getResolutionProposal(id).exists);
        vm.prank(provider);
        vm.expectRevert(PactoraEscrow.NoActiveResolutionProposal.selector);
        escrow.acceptResolutionProposal(id, stale);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.MilestoneTimeoutClaimed(id, 1, 2_000 ether);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.MilestoneApproved(id, 1, 2_000 ether);
        vm.expectEmit(true, false, false, true, address(escrow));
        emit PactoraEscrow.AgreementCompleted(id);
        vm.prank(provider);
        escrow.claimAfterTimeout(id, 1);
        assertEq(escrow.getAgreement(id).completedAt, vm.getBlockTimestamp());
        assertEq(uint256(escrow.getAgreement(id).state), uint256(PactoraEscrow.AgreementState.Completed));
        assertEq(musd.balanceOf(provider), 3_000 ether);
    }

    function test_Refund_ProposalInvalidationAndResolutionBothOrders() public {
        for (uint256 order = 0; order < 2; order++) {
            uint256 id = _createAndFundSampleAgreement();
            vm.prank(provider);
            escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
            bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
            vm.warp(escrow.getMilestone(id, 0).deliveryDeadline);
            if (order == 0) {
                vm.expectEmit(true, true, false, true, address(escrow));
                emit PactoraEscrow.ResolutionCancelled(id, client, hash);
                vm.prank(client);
                escrow.refundNoShow(id, 0);
                assertFalse(escrow.getResolutionProposal(id).exists);
                vm.prank(client);
                vm.expectRevert(PactoraEscrow.NoActiveResolutionProposal.selector);
                escrow.acceptResolutionProposal(id, hash);
            } else {
                vm.prank(client);
                escrow.acceptResolutionProposal(id, hash);
                vm.prank(client);
                vm.expectRevert(
                    _stateError(PactoraEscrow.AgreementState.Funded, PactoraEscrow.AgreementState.Cancelled)
                );
                escrow.refundNoShow(id, 0);
            }
        }
    }

    function test_TimeoutAndResolution_BothTransactionOrders() public {
        for (uint256 order = 0; order < 2; order++) {
            uint256 id = _createAndFundSampleAgreement();
            vm.prank(provider);
            escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            vm.prank(client);
            escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
            bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
            vm.warp(vm.getBlockTimestamp() + 7 days);
            if (order == 0) {
                vm.prank(provider);
                escrow.claimAfterTimeout(id, 0);
                vm.prank(provider);
                vm.expectRevert(PactoraEscrow.NoActiveResolutionProposal.selector);
                escrow.acceptResolutionProposal(id, hash);
            } else {
                vm.prank(provider);
                escrow.acceptResolutionProposal(id, hash);
                vm.prank(provider);
                vm.expectRevert(
                    _stateError(PactoraEscrow.AgreementState.Funded, PactoraEscrow.AgreementState.Cancelled)
                );
                escrow.claimAfterTimeout(id, 0);
            }
        }
    }

    function test_TerminalAgreements_RejectAllFurtherMilestoneActions() public {
        for (uint256 i = 0; i < 2; i++) {
            uint256 id = _createAndFundSampleAgreement();
            vm.prank(client);
            escrow.proposeResolution(id, i == 0 ? 0 : 3_000 ether, i == 0 ? 3_000 ether : 0);
            bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
            vm.prank(provider);
            escrow.acceptResolutionProposal(id, hash);
            PactoraEscrow.AgreementState state = escrow.getAgreement(id).state;
            bytes memory needsFunded = _stateError(PactoraEscrow.AgreementState.Funded, state);
            vm.startPrank(client);
            vm.expectRevert(needsFunded);
            escrow.approveMilestone(id, 0);
            vm.expectRevert(needsFunded);
            escrow.rejectMilestone(id, 0, REJECTION_HASH);
            vm.expectRevert(needsFunded);
            escrow.refundNoShow(id, 0);
            vm.expectRevert(_stateError(PactoraEscrow.AgreementState.Accepted, state));
            escrow.fundAgreement(id);
            vm.stopPrank();
            vm.startPrank(provider);
            vm.expectRevert(needsFunded);
            escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
            vm.expectRevert(needsFunded);
            escrow.claimAfterTimeout(id, 0);
            vm.stopPrank();
        }
    }

    function test_Events_CreationAcceptanceFundingSubmissionRejectionAndApproval() public {
        vm.expectEmit(true, true, true, true, address(escrow));
        emit PactoraEscrow.AgreementCreated(1, client, provider, address(musd), 3_000 ether, SAMPLE_TERMS_HASH);
        uint256 id = _createSampleAgreement();
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.AgreementAccepted(id, provider);
        vm.prank(provider);
        escrow.acceptAgreement(id);
        vm.prank(client);
        musd.approve(address(escrow), 3_000 ether);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.AgreementFunded(id, client, 3_000 ether);
        vm.prank(client);
        escrow.fundAgreement(id);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.MilestoneSubmitted(id, 0, SUBMISSION_HASH_1);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.MilestoneRejected(id, 0, REJECTION_HASH);
        vm.prank(client);
        escrow.rejectMilestone(id, 0, REJECTION_HASH);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_2);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit PactoraEscrow.MilestoneApproved(id, 0, 1_000 ether);
        vm.prank(client);
        escrow.approveMilestone(id, 0);
    }

    // --- V2 Exact Transfers and Rollback ---

    function test_ExactFunding_RejectsTaxesBonusesAndDecreasingEscrowBalance() public {
        for (uint256 mode = 0; mode < 5; mode++) {
            FeeOnTransferERC20 token = new FeeOnTransferERC20();
            token.mint(client, 50_000 ether);
            uint256 honest = _acceptedTokenAgreement(token);
            _fundTokenAgreement(token, honest);
            uint256 id = _acceptedTokenAgreement(token);
            vm.prank(client);
            token.approve(address(escrow), 3_000 ether);
            _setAdjustment(token, mode);
            uint256 senderBefore = token.balanceOf(client);
            uint256 supplyBefore = token.totalSupply();
            vm.prank(client);
            vm.expectRevert(PactoraEscrow.InexactTokenTransfer.selector);
            escrow.fundAgreement(id);
            assertEq(token.balanceOf(client), senderBefore);
            assertEq(token.balanceOf(address(escrow)), 3_000 ether);
            assertEq(token.totalSupply(), supplyBefore);
            assertEq(token.allowance(client, address(escrow)), 3_000 ether);
            assertEq(escrow.getAgreement(id).fundedAt, 0);
            assertEq(uint256(escrow.getAgreement(id).state), uint256(PactoraEscrow.AgreementState.Accepted));
            assertEq(escrow.getRemainingBalance(honest), 3_000 ether);
        }
    }

    function test_ExactPayouts_AllPathsRejectInexactTransfersAndPreserveSharedAssets() public {
        FeeOnTransferERC20 token = new FeeOnTransferERC20();
        token.mint(client, 50_000 ether);
        token.mint(provider, 10_000 ether);
        uint256 honest = _acceptedTokenAgreement(token);
        _fundTokenAgreement(token, honest);
        uint256 id = _acceptedTokenAgreement(token);
        _fundTokenAgreement(token, id);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.prank(client);
        escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
        bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
        vm.warp(escrow.getMilestone(id, 1).deliveryDeadline);

        for (uint256 mode = 0; mode < 5; mode++) {
            _setAdjustment(token, mode);
            for (uint256 action = 0; action < 4; action++) {
                vm.expectRevert(PactoraEscrow.InexactTokenTransfer.selector);
                _payout(id, action, hash);
                assertEq(token.balanceOf(address(escrow)), 6_000 ether);
                assertEq(token.balanceOf(client), 44_000 ether);
                assertEq(token.balanceOf(provider), 10_000 ether);
                assertEq(escrow.getAgreement(id).releasedAmount, 0);
                assertEq(escrow.getAgreement(id).refundedAmount, 0);
                assertEq(escrow.getAgreement(id).completedAt, 0);
                assertEq(uint256(escrow.getAgreement(id).state), uint256(PactoraEscrow.AgreementState.Funded));
                assertEq(uint256(escrow.getMilestone(id, 0).state), uint256(PactoraEscrow.MilestoneState.Submitted));
                assertEq(uint256(escrow.getMilestone(id, 1).state), uint256(PactoraEscrow.MilestoneState.Pending));
                assertEq(escrow.getResolutionProposal(id).proposalHash, hash);
                assertTrue(escrow.getResolutionProposal(id).exists);
                assertEq(escrow.getRemainingBalance(honest), 3_000 ether);
            }
        }
        token.setAdjustments(0, 0, 0, 0);
        vm.prank(provider);
        escrow.acceptResolutionProposal(id, hash);
        assertEq(token.balanceOf(address(escrow)), 3_000 ether);
        assertEq(escrow.getRemainingBalance(honest), 3_000 ether);
    }

    function test_TransferFailure_FundingAndSecondResolutionLegRollBack() public {
        FeeOnTransferERC20 token = new FeeOnTransferERC20();
        token.mint(client, 50_000 ether);
        uint256 id = _acceptedTokenAgreement(token);
        vm.prank(client);
        token.approve(address(escrow), 3_000 ether);
        token.setFailure(true, address(0));
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(token)));
        escrow.fundAgreement(id);
        assertEq(token.balanceOf(client), 50_000 ether);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(token.allowance(client, address(escrow)), 3_000 ether);
        assertEq(uint256(escrow.getAgreement(id).state), uint256(PactoraEscrow.AgreementState.Accepted));
        assertEq(escrow.getAgreement(id).fundedAt, 0);

        token.setFailure(false, client);
        vm.prank(client);
        escrow.fundAgreement(id);
        vm.prank(client);
        escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
        bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(token)));
        escrow.acceptResolutionProposal(id, hash);
        assertEq(token.balanceOf(provider), 0);
        assertEq(token.balanceOf(client), 47_000 ether);
        assertEq(token.balanceOf(address(escrow)), 3_000 ether);
        assertEq(escrow.getAgreement(id).releasedAmount, 0);
        assertEq(escrow.getAgreement(id).refundedAmount, 0);
        assertEq(escrow.getAgreement(id).completedAt, 0);
        assertEq(escrow.getResolutionProposal(id).proposalHash, hash);
        assertTrue(escrow.getResolutionProposal(id).exists);
        token.setFailure(false, address(0));
        vm.prank(provider);
        escrow.acceptResolutionProposal(id, hash);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(escrow.getAgreement(id).releasedAmount, 1_500 ether);
    }

    function test_Resolution_ZeroSideNeverCallsFailingRecipient() public {
        FeeOnTransferERC20 token = new FeeOnTransferERC20();
        token.mint(client, 50_000 ether);
        for (uint256 i = 0; i < 2; i++) {
            token.setFailure(false, address(0));
            uint256 id = _acceptedTokenAgreement(token);
            _fundTokenAgreement(token, id);
            token.setFailure(false, i == 0 ? client : provider);
            vm.prank(client);
            escrow.proposeResolution(id, i == 0 ? 0 : 3_000 ether, i == 0 ? 3_000 ether : 0);
            bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
            vm.prank(provider);
            escrow.acceptResolutionProposal(id, hash);
            assertEq(escrow.getRemainingBalance(id), 0);
        }
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_Reentrancy_FundingBlocksEveryMoneyEntrypointAndRollsBack() public {
        MaliciousERC20 token = new MaliciousERC20();
        escrow = new PactoraEscrow(address(token), false);
        token.transfer(client, 50_000 ether);
        uint256 id = _acceptedTokenAgreement(token);
        vm.prank(client);
        token.approve(address(escrow), 3_000 ether);
        bytes[] memory calls = _moneyCalls(id, bytes32(0));
        for (uint256 i = 0; i < calls.length; i++) {
            token.setAttack(escrow, calls[i], true);
            vm.prank(client);
            vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
            escrow.fundAgreement(id);
            assertEq(token.balanceOf(client), 50_000 ether);
            assertEq(token.balanceOf(address(escrow)), 0);
            assertEq(token.allowance(client, address(escrow)), 3_000 ether);
            assertEq(escrow.getAgreement(id).fundedAt, 0);
            assertEq(uint256(escrow.getAgreement(id).state), uint256(PactoraEscrow.AgreementState.Accepted));
            assertTrue(token.attackOnTransferFrom());
        }
        token.setAttack(PactoraEscrow(address(0)), bytes(""), true);
        vm.prank(client);
        escrow.fundAgreement(id);
        assertEq(token.balanceOf(address(escrow)), 3_000 ether);
        assertEq(token.totalSupply(), 1_000_000 ether);
    }

    function test_Reentrancy_EveryPayoutBlocksEveryMoneyEntrypointAndRollsBack() public {
        MaliciousERC20 token = new MaliciousERC20();
        escrow = new PactoraEscrow(address(token), false);
        token.transfer(client, 50_000 ether);
        uint256 id = _acceptedTokenAgreement(token);
        _fundTokenAgreement(token, id);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.prank(client);
        escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
        bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
        vm.warp(escrow.getMilestone(id, 1).deliveryDeadline);
        bytes[] memory calls = _moneyCalls(id, hash);
        for (uint256 action = 0; action < 4; action++) {
            for (uint256 i = 0; i < calls.length; i++) {
                token.setAttack(escrow, calls[i], false);
                vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
                _payout(id, action, hash);
                assertEq(token.balanceOf(address(escrow)), 3_000 ether);
                assertEq(token.balanceOf(client), 47_000 ether);
                assertEq(token.balanceOf(provider), 0);
                assertEq(escrow.getAgreement(id).releasedAmount, 0);
                assertEq(escrow.getAgreement(id).refundedAmount, 0);
                assertEq(escrow.getAgreement(id).completedAt, 0);
                assertEq(uint256(escrow.getMilestone(id, 0).state), uint256(PactoraEscrow.MilestoneState.Submitted));
                assertEq(uint256(escrow.getMilestone(id, 1).state), uint256(PactoraEscrow.MilestoneState.Pending));
                assertEq(escrow.getResolutionProposal(id).proposalHash, hash);
                assertTrue(token.attackOnTransfer());
            }
        }
    }

    function test_Resolution_AfterPartialReleaseAndRefundSettlesOnlyRemaining() public {
        uint256 id = _fundedWithDeadlines(_deadlines(3));
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.warp(escrow.getMilestone(id, 1).deliveryDeadline);
        vm.prank(client);
        escrow.approveMilestone(id, 0);
        vm.prank(client);
        escrow.refundNoShow(id, 1);
        assertEq(escrow.getRemainingBalance(id), 3_000 ether);
        vm.prank(client);
        escrow.proposeResolution(id, 500 ether, 2_500 ether);
        bytes32 hash = escrow.getResolutionProposal(id).proposalHash;
        vm.prank(provider);
        escrow.acceptResolutionProposal(id, hash);
        PactoraEscrow.Agreement memory agreement = escrow.getAgreement(id);
        assertEq(agreement.releasedAmount, 3_500 ether);
        assertEq(agreement.refundedAmount, 2_500 ether);
        assertEq(agreement.releasedAmount + agreement.refundedAmount, agreement.totalAmount);
        assertEq(agreement.completedAt, vm.getBlockTimestamp());
        assertEq(uint256(agreement.state), uint256(PactoraEscrow.AgreementState.Cancelled));
        assertEq(musd.balanceOf(address(escrow)), 0);
        assertEq(musd.balanceOf(provider), 3_500 ether);
        assertEq(musd.balanceOf(client), 46_500 ether);
    }

    function testFuzz_MixedSettlementConservesSharedAssets(uint96 paid, uint96 refunded, bool refundFirst, bool timeout)
        public
    {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = bound(paid, 1, 1_000_000 ether);
        amounts[1] = bound(refunded, 1, 1_000_000 ether);
        musd.mint(client, amounts[0] + amounts[1]);
        uint256 honest = _createAndFundSampleAgreement();
        vm.prank(client);
        uint256 id = escrow.createAgreement(
            provider,
            address(musd),
            amounts,
            _deadlinesAt(2, uint64(vm.getBlockTimestamp() + 1 days)),
            SAMPLE_TERMS_HASH
        );
        vm.prank(provider);
        escrow.acceptAgreement(id);
        _fundTokenAgreement(musd, id);
        vm.prank(provider);
        escrow.submitMilestone(id, 0, SUBMISSION_HASH_1);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        if (refundFirst) {
            vm.prank(client);
            escrow.refundNoShow(id, 1);
            _assertSharedAssets(id, honest);
        }
        if (timeout) {
            vm.prank(provider);
            escrow.claimAfterTimeout(id, 0);
        } else {
            vm.prank(client);
            escrow.approveMilestone(id, 0);
        }
        _assertSharedAssets(id, honest);
        if (!refundFirst) {
            vm.prank(client);
            escrow.refundNoShow(id, 1);
        }
        _assertSharedAssets(id, honest);
        PactoraEscrow.Agreement memory agreement = escrow.getAgreement(id);
        assertEq(agreement.releasedAmount, amounts[0]);
        assertEq(agreement.refundedAmount, amounts[1]);
        assertEq(agreement.releasedAmount + agreement.refundedAmount, agreement.totalAmount);
        assertEq(uint256(agreement.state), uint256(PactoraEscrow.AgreementState.Cancelled));
        assertEq(musd.balanceOf(provider), amounts[0]);
        assertEq(musd.balanceOf(address(escrow)), 3_000 ether);
        assertEq(escrow.getRemainingBalance(honest), 3_000 ether);
    }

    function testFuzz_ResolutionNonceSurvivesReplacementAndDeletion(uint8 count, bool providerProposes) public {
        uint256 id = _createAndFundSampleAgreement();
        address proposer = providerProposes ? provider : client;
        address acceptor = providerProposes ? client : provider;
        vm.prank(proposer);
        escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
        bytes32 current = escrow.getResolutionProposal(id).proposalHash;
        uint256 replacements = bound(count, 1, 8);
        for (uint256 i = 0; i < replacements; i++) {
            bytes32 stale = current;
            if (i % 2 == 0) {
                vm.prank(proposer);
                escrow.cancelResolutionProposal(id);
            }
            vm.prank(proposer);
            escrow.proposeResolution(id, 1_500 ether, 1_500 ether);
            current = escrow.getResolutionProposal(id).proposalHash;
            assertEq(current, _proposalHash(id, i + 2, proposer, 1_500 ether, 1_500 ether));
            assertNotEq(current, stale);
            vm.prank(acceptor);
            vm.expectRevert(PactoraEscrow.ProposalHashMismatch.selector);
            escrow.acceptResolutionProposal(id, stale);
        }
        vm.prank(acceptor);
        escrow.acceptResolutionProposal(id, current);
        assertEq(musd.balanceOf(address(escrow)), 0);
        assertFalse(escrow.getResolutionProposal(id).exists);
    }

    // --- Helpers ---

    function _createSampleAgreement() internal returns (uint256) {
        uint256[] memory milestones = new uint256[](2);
        milestones[0] = 1_000 * 10 ** 18;
        milestones[1] = 2_000 * 10 ** 18;

        vm.prank(client);
        return escrow.createAgreement(provider, address(musd), milestones, _deadlines(2), SAMPLE_TERMS_HASH);
    }

    function _createAndFundSampleAgreement() internal returns (uint256) {
        uint256 agreementId = _createSampleAgreement();

        vm.prank(provider);
        escrow.acceptAgreement(agreementId);

        vm.startPrank(client);
        musd.approve(address(escrow), 3_000 * 10 ** 18);
        escrow.fundAgreement(agreementId);
        vm.stopPrank();

        return agreementId;
    }

    function _deadlines(uint256 count) internal view returns (uint64[] memory deadlines) {
        deadlines = new uint64[](count);
        uint64 deadline = uint64(vm.getBlockTimestamp() + 30 days);
        for (uint256 i = 0; i < count; i++) {
            deadlines[i] = deadline;
        }
    }

    function _deadlinesAt(uint256 count, uint64 deadline) internal pure returns (uint64[] memory deadlines) {
        deadlines = new uint64[](count);
        for (uint256 i = 0; i < count; i++) {
            deadlines[i] = deadline;
        }
    }

    function _amounts(uint256 count) internal pure returns (uint256[] memory amounts) {
        amounts = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            amounts[i] = (i + 1) * 1_000 ether;
        }
    }

    function _stateError(PactoraEscrow.AgreementState expected, PactoraEscrow.AgreementState actual)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodeWithSelector(PactoraEscrow.InvalidAgreementState.selector, expected, actual);
    }

    function _proposalHash(uint256 id, uint256 nonce, address proposer, uint256 refund, uint256 release)
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(address(escrow), block.chainid, id, nonce, proposer, refund, release));
    }

    function _fundTokenAgreement(IERC20 token, uint256 id) internal {
        uint256 total = escrow.getAgreement(id).totalAmount;
        vm.startPrank(client);
        token.approve(address(escrow), total);
        escrow.fundAgreement(id);
        vm.stopPrank();
    }

    function _acceptedTokenAgreement(IERC20 token) internal returns (uint256 id) {
        vm.prank(client);
        id = escrow.createAgreement(provider, address(token), _amounts(2), _deadlines(2), SAMPLE_TERMS_HASH);
        vm.prank(provider);
        escrow.acceptAgreement(id);
    }

    function _fundedWithDeadlines(uint64[] memory deadlines) internal returns (uint256 id) {
        vm.prank(client);
        id = escrow.createAgreement(provider, address(musd), _amounts(deadlines.length), deadlines, SAMPLE_TERMS_HASH);
        vm.prank(provider);
        escrow.acceptAgreement(id);
        _fundTokenAgreement(musd, id);
    }

    function _setAdjustment(FeeOnTransferERC20 token, uint256 mode) internal {
        if (mode == 0) token.setAdjustments(1_000, 0, 0, 0);
        else if (mode == 1) token.setAdjustments(0, 1_000, 0, 0);
        else if (mode == 2) token.setAdjustments(0, 0, 20_000, 0);
        else if (mode == 3) token.setAdjustments(0, 20_000, 0, 0);
        else token.setAdjustments(0, 0, 0, 1_000);
    }

    function _payout(uint256 id, uint256 action, bytes32 hash) internal {
        if (action == 0) {
            vm.prank(client);
            escrow.approveMilestone(id, 0);
        } else if (action == 1) {
            vm.prank(provider);
            escrow.claimAfterTimeout(id, 0);
        } else if (action == 2) {
            vm.prank(client);
            escrow.refundNoShow(id, 1);
        } else {
            vm.prank(provider);
            escrow.acceptResolutionProposal(id, hash);
        }
    }

    function _moneyCalls(uint256 id, bytes32 hash) internal pure returns (bytes[] memory calls) {
        calls = new bytes[](5);
        calls[0] = abi.encodeCall(PactoraEscrow.fundAgreement, (id));
        calls[1] = abi.encodeCall(PactoraEscrow.approveMilestone, (id, 0));
        calls[2] = abi.encodeCall(PactoraEscrow.claimAfterTimeout, (id, 0));
        calls[3] = abi.encodeCall(PactoraEscrow.refundNoShow, (id, 1));
        calls[4] = abi.encodeCall(PactoraEscrow.acceptResolutionProposal, (id, hash));
    }

    function _assertSharedAssets(uint256 id, uint256 honest) internal view {
        PactoraEscrow.Agreement memory agreement = escrow.getAgreement(id);
        assertLe(agreement.releasedAmount + agreement.refundedAmount, agreement.totalAmount);
        assertEq(musd.balanceOf(address(escrow)), escrow.getRemainingBalance(id) + escrow.getRemainingBalance(honest));
    }
}
