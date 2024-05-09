// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {RandomnessConsumer} from "../src/RandomnessConsumer.sol";
// forge script script/deploy.s.sol --rpc-url $RPC_URL --broadcast
// Deployed at: 0xe5c2814Ff025BCb4219960Ab6E1bA89bf016AEF5
contract Deploy is Script {

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        RandomnessConsumer rc = new RandomnessConsumer();
        console.log("Deployed RandomnessConsumer.sol at address: ", address(rc));
        vm.stopBroadcast();
    }
}