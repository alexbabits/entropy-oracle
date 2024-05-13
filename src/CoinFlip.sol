// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {RandaoLib} from "./RandaoLib.sol";

// EXAMPLE - NOT AUDITED - DO NOT USE IN PRODUCTION - PROBABLY INSECURE
// Description: Randomness Consumer for a coin flip using a single block's future randao value. (INSECURE)
contract CoinFlip {

    uint256 requestId; // global ID nonced for every request

    mapping(address => UserInfo) public userInfo; // All info related to users coin flip
    mapping(address => uint256) public userWinnings; // Accrued winnings from coin flip wins
    mapping(uint256 => address) public reqIdToUser; // needed during fulfillRandomness callback to find user.

    struct UserInfo {
        bool requested;
        uint8 result; // 0 = uninitialized/deleted, 1 = lost, 2 = win
        uint32 blockNumber;
        uint256 randomness;  
    }

    event RequestRandomness(uint256 indexed requestId, uint32 indexed blockNumber);

    error IncorrectGamePayment();
    error AlreadyHasBlockNumber();
    error NoBlockNumber();
    error BlockTooOld();
    error BlockNotValidatedYet();
    error AlreadyRequestedRandomness();
    error NoRandomness();
    error NoWinnings();
    error FailedCall();

    // 1. User sets a future block number associated with their address so they can request randomness with it.
    function setUsersBlockNumber() public payable {
        if (msg.value != 1e15) revert IncorrectGamePayment();
        if (userInfo[msg.sender].blockNumber != 0) revert AlreadyHasBlockNumber();
        userInfo[msg.sender].blockNumber = uint32(block.number) + 4;
    }

    // 2. Once user's future block is in the past, they can ask the oracle to provide the block's header.
    function requestRandomness() public {
        requestId++;
        uint32 blockNumber = userInfo[msg.sender].blockNumber;
        if (blockNumber == 0) revert NoBlockNumber();
        if (blockNumber <= block.number - 256) revert BlockTooOld(); 
        if (blockNumber > block.number) revert BlockNotValidatedYet(); 
        if (userInfo[msg.sender].requested == true) revert AlreadyRequestedRandomness();
        
        userInfo[msg.sender].requested = true;
        reqIdToUser[requestId] = msg.sender; // Intentionally gets overwritten every request
        emit RequestRandomness(requestId, blockNumber);
    }

    // 3. Oracle provides header --> verified on chain --> randao extracted --> given to user.
    function fulfillRandomness(uint256 _requestId, bytes memory rlpEncodedHeader) public {
        address user = reqIdToUser[_requestId];
        bytes32 randao = RandaoLib.getHistoricalRandaoValue(userInfo[user].blockNumber, rlpEncodedHeader);
        userInfo[user].randomness = uint256(randao);
    }

    // 4. User can use the randomness associated with them now.
    function useRandomness() public {
        if (userInfo[msg.sender].randomness == 0) revert NoRandomness();
        uint256 rand100 = (userInfo[msg.sender].randomness % 100) + 1; // Convert raw rand into [1, 100] inclusive.
        userInfo[msg.sender].result = rand100 > 50 ? 2 : 1; // flip coin
        if (userInfo[msg.sender].result == 2) userWinnings[msg.sender] += 2e15; // Accrue 0.002 ETH winnings if won
        delete userInfo[msg.sender]; // userInfo must be cleared after use.
    }

    // 5. User can manually withdraw any winnings via pull technique (assuming contract solvency)
    function claimWinnings() public {
        if (userWinnings[msg.sender] == 0) revert NoWinnings();
        (bool sent, ) = msg.sender.call{value: userWinnings[msg.sender]}("");
        if (!sent) revert FailedCall();
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
        emit RequestRandomness(123, uint32(block.number));
    }
}