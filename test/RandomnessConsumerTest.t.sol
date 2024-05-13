// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {CoinFlip} from "../src/CoinFlip.sol";
//@audit incomplete tests
contract RandomnessConsumerTest is Test {

    CoinFlip public coinFlip;
    uint256 sepoliaFork;
    uint256 sepoliaBlock = 5800000;
    string RPC_URL = vm.envString("RPC_URL");

    function setUp() public {
        sepoliaFork = vm.createFork(RPC_URL);
        vm.selectFork(sepoliaFork);
        vm.rollFork(sepoliaBlock);
        coinFlip = new CoinFlip();
    }

    function test_EmitEvent() public {
        assertEq(block.number, sepoliaBlock);
        vm.expectEmit();
        emit CoinFlip.RequestRandomness(123, uint32(sepoliaBlock));
        coinFlip.emitEvent();

        // In foundry, cannot use current block, so we roll forward first
        vm.rollFork(sepoliaBlock + 10);
        assertEq(block.number, sepoliaBlock + 10);
        bytes32 bh = coinFlip.getBlockHash(sepoliaBlock);
        assertEq(bh, 0x4d6a121cdf8f179e5e39c9d655db44ab09f3cb4fa2e7fa3115a82c2d26087dbb);

        // Can't figure out how to get RLP header proof in here yet.
        //bytes32 mixHash = coinFlip.getRandao(sepoliaBlock,  );
    }

}