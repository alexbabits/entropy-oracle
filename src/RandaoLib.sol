// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {RLPDecoder} from "./RLPDecoder.sol";

// Original Author: https://github.com/ethstorage/storage-contracts-v1/blob/main/contracts/RandaoLib.sol
// Purpose: Verification and extraction of RANDAO (mixHash) value from an RLP-encoded block header.
library RandaoLib {
    using RLPDecoder for RLPDecoder.RLPItem;
    using RLPDecoder for RLPDecoder.Iterator;
    using RLPDecoder for bytes;

    // Extracts the RANDAO value from the provided RLP-encoded header
    function getRandaoFromHeader(RLPDecoder.RLPItem memory item) pure internal returns (bytes32) {
        RLPDecoder.Iterator memory iterator = item.iterator();
        for (uint256 i = 0; i < 13; i++) {
            iterator.next(); // mixHash is at item 13 (0-base index)
        }
        return bytes32(iterator.next().toUint());
    }

    // Verifies the provided RLP-encoded block header matches the known hash of that header
    function verifyHeaderAndGetRandao(bytes32 headerHash, bytes memory headerRlpBytes) pure internal returns (bytes32) {
        RLPDecoder.RLPItem memory item = headerRlpBytes.toRlpItem();
        require(headerHash == item.rlpBytesKeccak256(), "header hash mismatch");
        return getRandaoFromHeader(item);
    }

    // Given a block number and the block header in RLP bytes, returns the RANDAO value.
    function getHistoricalRandaoValue(uint256 blockNumber, bytes memory headerRlpBytes) view internal returns (bytes32) {
        bytes32 bh = blockhash(blockNumber); // up to 256 in the past I think?
        require(bh != bytes32(0), "failed to obtain blockhash");
        return verifyHeaderAndGetRandao(bh, headerRlpBytes);
    }    
}