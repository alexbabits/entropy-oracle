// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CoinFlip} from "../src/CoinFlip.sol";

// `forge script script/DeployCoinFlip.s.sol --rpc-url $RPC_URL --broadcast`
contract DeployCoinFlip is Script {

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        CoinFlip coinFlip = new CoinFlip();
        console.log("Deployed CoinFlip.sol at address: ", address(coinFlip));

        vm.stopBroadcast();
    }
}