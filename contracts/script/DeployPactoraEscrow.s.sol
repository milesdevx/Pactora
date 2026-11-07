// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PactoraEscrow} from "../src/PactoraEscrow.sol";

contract DeployPactoraEscrow is Script {
    // Canonical MUSD from the official Mezo testnet configuration.
    // https://mezo.org/docs/developers/getting-started/musd-payments-x402/#mezo-x402-reference
    address public constant MEZO_TESTNET_MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    uint256 public constant MEZO_TESTNET_CHAIN_ID = 31611;

    error NotMezoTestnet();

    function run() external returns (PactoraEscrow escrow) {
        if (block.chainid != MEZO_TESTNET_CHAIN_ID) revert NotMezoTestnet();
        vm.startBroadcast();

        escrow = new PactoraEscrow(MEZO_TESTNET_MUSD, true);

        vm.stopBroadcast();

        console.log("PactoraEscrow deployed to:", address(escrow));
        console.log("Configured MUSD token:", MEZO_TESTNET_MUSD);
    }
}
