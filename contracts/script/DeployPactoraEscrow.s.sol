// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PactoraEscrow} from "../src/PactoraEscrow.sol";

contract DeployPactoraEscrow is Script {
    // Verified Mezo Testnet MUSD address
    address public constant MEZO_TESTNET_MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;

    function run() external returns (PactoraEscrow escrow) {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address musdAddress = vm.envOr("MUSD_ADDRESS", MEZO_TESTNET_MUSD);

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        // Deploy with MUSD as default allowed token, allowlist enforcement disabled to allow custom ERC20s if needed
        escrow = new PactoraEscrow(musdAddress, false);

        vm.stopBroadcast();

        console.log("PactoraEscrow deployed to:", address(escrow));
        console.log("Configured MUSD token:", musdAddress);
    }
}

