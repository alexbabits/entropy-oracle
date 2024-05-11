### Overview
This is a new randomness oracle solution using the inherit randomness found in block headers. Block header's RANDAO value is used to randomly select a new proposer in PoS. By using this RANDAO value directly, we do not need to generate the random number ourselves. This means we do not need any complex proofs to verify that the random number is truly random and untampered. We only need a simple proof - Ensuring the block header for a particular block is correct. This is done on chain by comparing the recreated block hash that was sent from the oracle to the actual block hash for that block.

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


### References/Notes
* EIP 4399: https://ethereum-magicians.org/t/eip-4399-supplant-difficulty-opcode-with-random/7368
* RANDAO(n): https://ethereum-magicians.org/t/expanding-eip-4399-prevrandao-with-randao-n/19741/11
* NOTE: Many APIs still use the antiquated nomenclature `mixHash` when retrieving block information, but this is referring to the `randao` value. (`mixHash` is from PoW, `randao` is from PoS).

### block.prevrandao vs randao(n) technique
* With `block.prevrandao`, it gives you the randao value from the immediate previous block with respect to whichever block the transaction executes in. The user has the freedom to revert their transaction until they calculate a beneficial `block.prevrandao` value. There is no way to escape the vulnerability through a fancy time lock delay or hashing or anything. The user never has to finish a function call until they get the roll or setup that they want, ensuring 100% success. With `block.prevrandao` you can always "choose" the roll you want. 
* Imagine a lottery scenario. Regardless of who is claiming the lottery result (user or owner), they can revert the transaction until it is profitable even if you had some minimum block or time in the future before you could execute the claim request for randomness. Imagine you have a bunch of user's that paid to enter a lottery and then at block 1000 there are no more accepted bids. You declare that the lottery will be rolled at any point after block 1100 or 30 minutes from the final bid. When block 1100 or later comes, the owner can still choose when to roll the lottery, reverting whenever they want, and then executing only when they want to. What if you had a section of time to claim from block 1100 to 1150? That is still 50 blocks to claim, and what if the owner finds no beneficial number, and simply doesn't claim during that time period? The lottery is refunded and they could just game the system for that 50 block window until they drew the number they wanted. What if there is zero window of time and you must execute the claim at exactly block 1100? Well, the owner or users can still just revert the transaction if its unfavorable, and would get refunded. If they don't get refunded this is way too dangerous because if they ever miss the execution in the exact block, or time window, they would lose their lottery bid funds. You would need to have a trustless execution on chain that never reverts after the waiting time, at a specific time, which is impossible. The only way to do this would be with a decentralized off chain oracle system that executes transactions at a particular time for the lottery, where they are penalized if they fail to do their job.
* With `randao(n)` type of technique we employ with the oracles, the block assigned to a user must be in the future. This means there is no way to "choose" the roll you want, because the block does not exist, has not yet been verified, and the randao value in it's header is unknown until then. When a user requests a random number from their future block which has passed, the oracle simply retrieves that random number from that block. The protocol should essentially freeze the user until they use their randomness value.
* See PoC and more here: https://medium.com/@alexbabits/why-block-prevrandao-is-a-useless-dangerous-trap-and-how-to-fix-it-5367ed3c6dfc

### Questions
* What happens if the oracle isn't listening to a request and then re-boots? Is that request lost?
* What happens if the fulfillRandomness function reverts?
* What happens if a re-org happens? 
* What happens if the oracle system fails to listen and callback from a requestRandomness function? Reconnection logic and Error handling around WebSocket for disconnections and issues.
* What steps should we take on the oracle side vs the developers side (responsibilities and security, for example the future block stuff).
* What happens if a block that does not exist yet is requested?
* What if multiple consumers request randomness during the same block, can the oracles process multiple requests in a single block properly?
* Should payment be in gas token or ORK oracle protocol token?
* Should payments be subscription based, or direct payment, or both? With Chainlink you can have multiple consumer contracts under the umbrella of one funded subscription.
* Is the `mixHash` a truly random number when converted from bytes32 to uint256? Can it be "split up" to use multiple random numbers from 1 request?
* If the oracles are widely used, it may be better approach to have the oracles RLP encode every single block, and then just match the encoded block with the incoming requests. That way they always have them at disposal if needed. We also don't want to be doing redundant computations (imagine two consumers request from the same block).
* Using L2 RANDAO for randomness is not advised because the sequencer can easily forge any RANDAO number. A look up L1 RANDAO from L2 would fix this. An RIP is proposing to support reading L1 block hash and thus L1 RANDAO: https://github.com/ethereum/RIPs/issues/16


### Attack Vector Discussion
1. It costs nothing to see what the future randao value would be, and can be calculated sufficiently fast enough. Every block proposer has 1 bit of influence power per slot. A coalition of proposers have 2^n "rolls" where n is the number of malicious proposers in a row. 5 proposers would get 32 roll chances to produce the most desired randao value. The proposer may deliberately refuse to propose an entire block to prevent a RANDAO mix from being updated in a particular slot if they found a beneficial randao value. This costs them the block reward and tx fees they would have received. If they found no useful random value, they can propose blocks like normal and lose nothing. The proposer's 1 bit of influence power lasts only until the first honest RANDAO reveal is made afterwards. This applies also to a string of multiple malicious proposers. One honest block proposal is enough to unbias the RANDAO value even if it was biased during several slots in a row.
2. Proposers can ALSO gain 1 bit of influence power on apps by simply excluding the dice roll in their current slot transaction, and instead forcing the transaction to be included in the next block, thus forcing the RANDAO value to be that of the next block which the proposer knows in advance. This costs them nothing to execute this attack.

* The proposer manipulation threat is neutralized by associating an array of future blocks with a randomness request, and hashing each of their randao values to return a single bytes32 value. The more blocks you include, the more proposers have to be colluding together. For example, say you request a random number derived from 3 block numbers. The oracle gets the 3 randao values and then hashes them to give you a single bytes32 value as the randomness value back to the user.
* If the future blocks are less than 128 blocks (4 epochs) into the future, the malicious user knows exactly who the proposers are going to be, and can simply wait until his validator(s) will be a proposer, and then match the block that he is assigned to when his proposer will propose that block, for 2^m "rolls". Again, if you had an array of 10 future blocks associated with a request, all 10 blocks would have to be controlled/proposed by the malicious actor.
* If the future blocks are more than 128 blocks (4 epochs) into the future, nobody knows who the proposer(s) will be. This separates a malicious user completely from knowing if his malicious proposers will be used or not. 
* The ultimate bulwark would be having an array of like 10 block numbers over 128. This requires ALL 10 proposers that are unknown at the time to each collude with each other. If just one was honest, then the random number is not manipulated.

### Current Tasks
Working on: Any interfaces/coordinator/base consumer interface template, and make sure everything is correct there while still using the single block number request system.

0. Who is in charge of the security, the implementer or our oracle? Can we cleanse some bad inputs through an interface? Consumer will need some best practices for security, but we should try to have a lot of that cleansed through our coordinator/oracle.
1. Array of block numbers per request. (It must search for the largest one, verifying that it has passed).
2. Oracle that fulfills request for ANY randomness consumer contract (whitelist/registration/interface) needed for consumers.
3. Payments. (Cover gas, and then a fee). Or it's free and just charge per access 24 hours, like 1,000 PLS per hour. Or fund a subscription, that might be best.
4. Leave the possibility for multiple oracles in the future. (This creates LOTS of complications though.)