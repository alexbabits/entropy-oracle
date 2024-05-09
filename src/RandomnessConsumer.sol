// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {RandaoLib} from "./RandaoLib.sol";

contract RandomnessConsumer {

    uint256 requestId;
    mapping(address => UserInfo) public userInfo;
    mapping(uint256 => address) public reqIdToUser; // needed during fulfillRandomness callback to match user.

    struct UserInfo {
        bool requested;
        uint256 blockNumber;
        uint256 randomness;
        uint256 result; // 0 = uninitialized, 1 = lost, 2 = win
    }

    event RequestRandomness(uint256 indexed requestId, uint256 indexed blockNumber);

    error IncorrectPayment();
    error AlreadyHasBlockNumber();
    error NotMatured();
    error NoBlockNumber();
    error NoRandomness();
    error AlreadyRequestedRandomness();

    // 1. User sets a future block number associated with their address
    function setUsersBlockNumber() public {
        if (userInfo[msg.sender].blockNumber != 0) revert AlreadyHasBlockNumber();
        userInfo[msg.sender].blockNumber = block.number + 4;
    }

    // 2. Once their future block is in the past, they can ask the oracle to give the block's mixHash to them.
    function requestRandomness() public {
        requestId++;
        uint256 blockNumber = userInfo[msg.sender].blockNumber;
        if (userInfo[msg.sender].requested == true) revert AlreadyRequestedRandomness();
        if (blockNumber == 0) revert NoBlockNumber();
        if (blockNumber > block.number) revert NotMatured();
        userInfo[msg.sender].requested = true;
        reqIdToUser[requestId] = msg.sender;
        emit RequestRandomness(requestId, blockNumber);
    }

    // 3. Oracle provides user the header, which is verified on chain and the mixHash is extracted.
    function fulfillRandomness(uint256 _requestId, bytes memory rlpEncodedHeader) public {
        address user = reqIdToUser[_requestId]; // Get the user from the reqId
        bytes32 mixHash = RandaoLib.getHistoricalRandaoValue(userInfo[user].blockNumber, rlpEncodedHeader); // verify block and get randao value
        userInfo[user].randomness = uint256(mixHash); // Give user the randomness
    }

    // 4. User can use the randomness associated with them now.
    function useRandomness() public {
        if (userInfo[msg.sender].randomness == 0) revert NoRandomness();
        uint256 rand = userInfo[msg.sender].randomness;
        uint256 rand100 = (rand % 100) + 1; // Convert raw rand into [1, 100] inclusive.
        userInfo[msg.sender].result = rand100 > 50 ? 2 : 1; // give user coin flip result
        userInfo[msg.sender].requested = false; // user can request randomness again
        delete userInfo[msg.sender].randomness; // randomness no longer needed
        delete userInfo[msg.sender].blockNumber; // Delete user's block b/c no longer needed
        // (Should just delete whole user struct, result no longer needed either).
    }

    // Test function 1 
    function getBlockHash(uint256 blockNumber) public view returns (bytes32) {
        bytes32 bh = blockhash(blockNumber);
        return bh;
    }

    // Test function 2
    function getRandao(uint256 blockNumber, bytes memory headerRlpBytes) public view returns (bytes32) {
        bytes32 randao = RandaoLib.getHistoricalRandaoValue(blockNumber, headerRlpBytes);
        return randao;
    }

    // Test function 3
    function emitEvent() public {
        emit RequestRandomness(123, block.number);
    }
}