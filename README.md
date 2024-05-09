### Overview
This is a novel randomness oracle solution using the inherit randomness found in block headers. The inherit randomness is the RANDAO value used to randomly select a new proposer. Because we do not need to generate the random number ourselves, we do not need to do any complex proofs to verify that this random number is a valid and trustless random number. The only verification needed is ensuring the block header for a particular block is correct. This is done by comparing a recreated block hash to the actual block hash.

Why can't we just use `block.prevrandao`? The randao value here is always taken from the immediate previous block that the transaction will be executed in. This means anyone can write a malicious contract to revert their transaction call until the random number is beneficial. See PoC and more here: https://medium.com/@alexbabits/why-block-prevrandao-is-a-useless-dangerous-trap-and-how-to-fix-it-5367ed3c6dfc

See notes and randomness related discussions here:
* EIP 4399: https://ethereum-magicians.org/t/eip-4399-supplant-difficulty-opcode-with-random/7368
* RANDAO(n): https://ethereum-magicians.org/t/expanding-eip-4399-prevrandao-with-randao-n/19741/11
* NOTE: Many APIs still use the antiquated nomenclature `mixHash` but this is really referring to the `randao` value. (`mixHash` is from PoW, `randao` is from PoS).
* NOTE: I'm currently trying to figure out if assigning a block number at least 128 blocks (4 epochs) into the future (but no more than 256, because beyond that `block.hash` fails) completely prevents all randao manipulation attempts. The idea is that proposers are known 4 epochs in advance, but not beyond that. I don't think this protects anything though, because if there is a group of malicious proposers beyond that, where your randao value wants to be executed, they can still forego their block rewards to try and make another randao value. 
* NOTE: Does NOT work on L2's because the sequencer can manipulate the randao value more easily.

### Architecture
This is a hardhat and foundry project. Foundry was needed for ease of use during interactions and testing. Hardhat JS functionality was needed for ease of use for testing the oracle.

* `/oracle/oracle.js`: Contains the oracle that listens to `requestRandomness` events for a user. It RLP-encodes the header of the block from the event, verifies that the hash matches so that we know our packaged header is correct, and then ships the header back on chain through `sendEncodedHeader()` which sends a transaction to the RandomnessConsumer contract's callback function `fulfillRandomWords()` just like Chainlink VRF.
* `deploy.s.sol`: Deploy RandomnessConsumer contract.
* `RandaoLib.sol`: Used to verify that a block header is correct for a particular block number (The recreated hash from the shipped header matches the actual block hash). And has a function to extract the randomness value (mixHash) from the verified block header.
* `RandomnessConsumer.sol`: The protocol that allows users to request secure, trustless randomness.
* `RLPDecoder.sol`: Helps `RandaoLib.sol` to properly decode, verify, and extract the randomness (mixHash/randao) from the shipped RLP-encoded block header. 
* `RandomnessConsumerTest.t.js` & `RandomnessConsumerTest.t.js`: Incomplete tests used for some sanity checks.
* NOTE: If you alter the RandomnessConsumer contract, to get the fresh ABI for the oracle, you may need to do `npx hardhat clean` and then recompile `npx hardhat compile`.

### Tests
* hardhat: `npx hardhat test`
* foundry: `forge test`

### Sepolia Interactions Setup
1. Deploy contract: `forge script script/deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast`
2. Start oracle: `cd oracle` --> `node oracle.js`. This starts the listener. (websocket RPC Sepolia needed).
3. Fork sepolia: `anvil --fork-url $SEPOLIA_RPC_URL`.
4. export RandomnessConsumer contract: `export RC="0xe5c2814Ff025BCb4219960Ab6E1bA89bf016AEF5"`

### Sepolia Request Randomness
0. For any state changing function that you want to view the resulting up-to-date state with foundry cast, you must restart anvil to get the latest Sepolia block. Get all users info anytime with `cast call $RC "userInfo(address)" $ALICE`
1. Set users future block: `cast send $RC "setUsersBlockNumber()" --from $ALICE --private-key $ALICE_PK --rpc-url $SEPOLIA_RPC_URL`
2. Request randomness: `cast send $RC "requestRandomness()" --from $ALICE --private-key $ALICE_PK --rpc-url $SEPOLIA_RPC_URL`
3. Flip coin, yielding either 1 or 2: `cast send $RC "useRandomness()" --from $ALICE --private-key $ALICE_PK --rpc-url $SEPOLIA_RPC_URL`