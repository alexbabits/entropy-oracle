// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {RandaoLib} from "./RandaoLib.sol";

// EXAMPLE - ALL FUNCTIONS PUBLIC - PSEUDO-MOCK CODE - DO NOT USE IN PRODUCTION
// Description: Randomness Consumer for a coin flip using a SINGLE block's future randao value. (INSECURE)
contract CoinFlipMulti {

    uint256 requestId; // global ID nonced for every randomness request

    mapping(address => UserInfo) public userInfo; // All info related to users coin flip
    mapping(address => uint256) public userWinnings; // Accrued winnings from coin flip wins
    mapping(uint256 => address) public reqIdToUser; // needed during fulfillRandomness callback to find user.

    struct UserInfo {
        bool requested;
        uint8 result; // 0 = uninitialized/deleted, 1 = lost, 2 = win
        uint32 blockNumberOne;
        uint32 blockNumberTwo;
        uint32 blockNumberThree;
        uint256 randomness;  
    }

    event RequestRandomness(uint256 indexed requestId, uint32 blockNumberOne, uint32 blockNumberTwo, uint32 blockNumberThree);

    error IncorrectGamePayment();
    error AlreadyHasBlockNumber();
    error NoBlockNumber();
    error BlockTooOld();
    error BlockNotValidatedYet();
    error AlreadyRequestedRandomness();
    error NoRandomness();
    error NoWinnings();
    error FailedCall();

    // 1. User sets future blocks associated with their address so they can request randomness using their randao values.
    function setUsersBlockNumbers() public payable {
        if (msg.value != 1e15) revert IncorrectGamePayment();
        if (userInfo[msg.sender].blockNumberOne != 0) revert AlreadyHasBlockNumber();
        userInfo[msg.sender].blockNumberOne = uint32(block.number) + 3; // Does not have to be ++,
        userInfo[msg.sender].blockNumberTwo = uint32(block.number) + 4; // gaps are fine too,
        userInfo[msg.sender].blockNumberThree = uint32(block.number) + 5; // but doesn't increase security
    }

    // 2. Once user's largest block is in the past, they can ask the oracle to provide the block headers.
    function requestRandomness() public {
        requestId++;

        uint32 blockNumberOne = userInfo[msg.sender].blockNumberOne;
        uint32 blockNumberTwo = userInfo[msg.sender].blockNumberTwo;
        uint32 blockNumberThree = userInfo[msg.sender].blockNumberThree;

        if (blockNumberOne == 0) revert NoBlockNumber();
        if (blockNumberOne <= block.number - 256) revert BlockTooOld(); // check smallest block
        if (blockNumberThree > block.number) revert BlockNotValidatedYet(); // check largest block
        if (userInfo[msg.sender].requested == true) revert AlreadyRequestedRandomness();
        
        userInfo[msg.sender].requested = true;
        reqIdToUser[requestId] = msg.sender; // Intentionally gets overwritten every request
        emit RequestRandomness(requestId, blockNumberOne, blockNumberTwo, blockNumberThree);
    }

    // 3. Oracle provides headers --> verified on chain --> randaos extracted + combined --> given to user.
    function fulfillRandomness(uint256 _requestId, bytes[] memory rlpEncodedHeaders) public {
        address user = reqIdToUser[_requestId];
        bytes32[] memory randaos = new bytes32[](3);

        randaos[0] = RandaoLib.getHistoricalRandaoValue(userInfo[user].blockNumberOne, rlpEncodedHeaders[0]);
        randaos[1] = RandaoLib.getHistoricalRandaoValue(userInfo[user].blockNumberTwo, rlpEncodedHeaders[1]);
        randaos[2] = RandaoLib.getHistoricalRandaoValue(userInfo[user].blockNumberThree, rlpEncodedHeaders[2]);

        bytes32 combinedRandao = keccak256(abi.encodePacked(randaos[0], randaos[1], randaos[2]));
        userInfo[user].randomness = uint256(combinedRandao);
    }

    // 4. User can use the randomness associated with them now.
    function useRandomness() public {
        if (userInfo[msg.sender].randomness == 0) revert NoRandomness();
        uint256 rand100 = (userInfo[msg.sender].randomness % 100) + 1; // Convert raw rand into [1, 100] inclusive.
        userInfo[msg.sender].result = rand100 > 50 ? 2 : 1; // flip coin
        if (userInfo[msg.sender].result == 2) userWinnings[msg.sender] += 2e15; // Accrue 0.002 ETH winnings if won
        delete userInfo[msg.sender]; // userInfo must be cleared after use.
    }

    // 5. User can manually withdraw any winnings (assuming contract solvency)
    function claimWinnings() public {
        uint256 _userWinnings = userWinnings[msg.sender];
        if (_userWinnings == 0) revert NoWinnings();
        delete userWinnings[msg.sender];
        (bool sent, ) = msg.sender.call{value: _userWinnings}("");
        if (!sent) revert FailedCall();
    }
}