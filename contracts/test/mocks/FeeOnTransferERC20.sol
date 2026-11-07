// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";

contract FeeOnTransferERC20 is MockERC20 {
    uint256 public senderFeeBps;
    uint256 public recipientFeeBps;
    uint256 public senderBonusBps;
    uint256 public recipientBonusBps;
    bool public failFunding;
    address public failRecipient;

    constructor() MockERC20("Adjustable Transfer Token", "ATT") {}

    function setAdjustments(uint256 senderFee, uint256 recipientFee, uint256 senderBonus, uint256 recipientBonus)
        external
    {
        senderFeeBps = senderFee;
        recipientFeeBps = recipientFee;
        senderBonusBps = senderBonus;
        recipientBonusBps = recipientBonus;
    }

    function setFailure(bool funding, address recipient) external {
        failFunding = funding;
        failRecipient = recipient;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (to == failRecipient) return false;
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (failFunding) return false;
        return super.transferFrom(from, to, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);
        if (from != address(0) && to != address(0)) {
            if (senderFeeBps > 0) super._update(from, address(0), amount * senderFeeBps / 10_000);
            if (recipientFeeBps > 0) super._update(to, address(0), amount * recipientFeeBps / 10_000);
            if (senderBonusBps > 0) super._update(address(0), from, amount * senderBonusBps / 10_000);
            if (recipientBonusBps > 0) super._update(address(0), to, amount * recipientBonusBps / 10_000);
        }
    }
}
