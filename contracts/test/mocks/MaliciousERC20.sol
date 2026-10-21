// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PactoraEscrow} from "../../src/PactoraEscrow.sol";

contract MaliciousERC20 is IERC20 {
    string public name = "Malicious MUSD";
    string public symbol = "mMUSD";
    uint8 public decimals = 18;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    PactoraEscrow public escrow;
    uint256 public targetAgreementId;
    bool public attackOnTransfer;

    constructor() {
        balanceOf[msg.sender] = 1_000_000 * 10 ** 18;
    }

    function setEscrowTarget(PactoraEscrow _escrow, uint256 _agreementId) external {
        escrow = _escrow;
        targetAgreementId = _agreementId;
        attackOnTransfer = true;
    }

    function totalSupply() external pure override returns (uint256) {
        return 1_000_000 * 10 ** 18;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        if (attackOnTransfer && address(escrow) != address(0)) {
            attackOnTransfer = false;
            // Attempt reentrant call to approveMilestone
            escrow.approveMilestone(targetAgreementId, 0);
        }
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

