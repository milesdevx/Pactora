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
    bool public attackOnTransferFrom;
    bytes public attackData;

    constructor() {
        balanceOf[msg.sender] = 1_000_000 * 10 ** 18;
    }

    function setEscrowTarget(PactoraEscrow _escrow, uint256 _agreementId) external {
        escrow = _escrow;
        targetAgreementId = _agreementId;
        attackOnTransfer = true;
        attackOnTransferFrom = false;
        attackData = abi.encodeCall(PactoraEscrow.approveMilestone, (_agreementId, 0));
    }

    function setAttack(PactoraEscrow target, bytes calldata data, bool onTransferFrom) external {
        escrow = target;
        attackData = data;
        attackOnTransfer = !onTransferFrom;
        attackOnTransferFrom = onTransferFrom;
    }

    function totalSupply() external pure override returns (uint256) {
        return 1_000_000 * 10 ** 18;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        if (attackOnTransfer && address(escrow) != address(0)) {
            attackOnTransfer = false;
            _attack();
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
        if (attackOnTransferFrom && address(escrow) != address(0)) {
            attackOnTransferFrom = false;
            _attack();
        }
        return true;
    }

    function _attack() private {
        (bool success, bytes memory reason) = address(escrow).call(attackData);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(reason, 0x20), mload(reason))
            }
        }
    }
}
