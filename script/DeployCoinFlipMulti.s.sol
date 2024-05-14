// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {CoinFlipMulti} from "../src/CoinFlipMulti.sol";

// `forge script script/DeployCoinFlipMulti.s.sol --rpc-url $RPC_URL --broadcast`
contract DeployCoinFlipMulti is Script {

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        CoinFlipMulti coinFlipMulti = new CoinFlipMulti();
        console.log("Deployed CoinFlipMulti.sol at address: ", address(coinFlipMulti));

        vm.stopBroadcast();
    }
}