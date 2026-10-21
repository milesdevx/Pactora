// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PactoraEscrow} from "../src/PactoraEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MaliciousERC20} from "./mocks/MaliciousERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
            provider,
            address(musd),
            milestones,
            SAMPLE_TERMS_HASH
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

    function test_CreateAgreement_Revert_ZeroAddress() public {
        uint256[] memory milestones = new uint256[](1);
        milestones[0] = 500 * 10 ** 18;

        vm.prank(client);
        vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
        escrow.createAgreement(address(0), address(musd), milestones, SAMPLE_TERMS_HASH);

        // Cannot create agreement with oneself as provider
        vm.prank(client);
        vm.expectRevert(PactoraEscrow.InvalidAddress.selector);
        escrow.createAgreement(client, address(musd), milestones, SAMPLE_TERMS_HASH);
    }

    function test_CreateAgreement_Revert_ZeroMilestoneAmount() public {
        uint256[] memory milestones = new uint256[](2);
        milestones[0] = 1_000 * 10 ** 18;
        milestones[1] = 0; // Invalid zero amount

        vm.prank(client);
        vm.expectRevert(PactoraEscrow.InvalidMilestones.selector);
        escrow.createAgreement(provider, address(musd), milestones, SAMPLE_TERMS_HASH);
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
        escrow.acceptResolutionProposal(agreementId);

        // Provider accepts proposal
        uint256 clientPre = musd.balanceOf(client);
        uint256 providerPre = musd.balanceOf(provider);

        vm.prank(provider);
        escrow.acceptResolutionProposal(agreementId);

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
        PactoraEscrow freshEscrow = new PactoraEscrow(address(0), false);

        uint256[] memory milestones = new uint256[](1);
        milestones[0] = 500 * 10 ** 18;

        // Client creates agreement with malicious token
        vm.prank(client);
        uint256 agId = freshEscrow.createAgreement(
            provider,
            address(maliciousToken),
            milestones,
            SAMPLE_TERMS_HASH
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
        uint256 agreementId = escrow.createAgreement(
            provider,
            address(musd),
            milestones,
            SAMPLE_TERMS_HASH
        );

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

    // --- Helpers ---

    function _createSampleAgreement() internal returns (uint256) {
        uint256[] memory milestones = new uint256[](2);
        milestones[0] = 1_000 * 10 ** 18;
        milestones[1] = 2_000 * 10 ** 18;

        vm.prank(client);
        return escrow.createAgreement(provider, address(musd), milestones, SAMPLE_TERMS_HASH);
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
}

