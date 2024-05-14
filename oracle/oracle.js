const assert = require('assert');
const RLP = require('rlp');
const { ethers } = require("ethers");
const { Web3 } = require('web3');
require("dotenv").config({ path: '../.env' }); 
const coinFlipABI = require("../artifacts/src/CoinFlip.sol/CoinFlip.json").abi;
const coinFlipMultiABI = require("../artifacts/src/CoinFlipMulti.sol/CoinFlipMulti.json").abi;

// Connect to provider (HTTPS): `const web3 = new Web3(process.env.RPC_URL);`
// Connect to provider (WebSocket):
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WS_RPC_URL));

// Create signer
const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);

// Instantiate CoinFlip contract
let coinFlip;
const coinFlipAddress = "0xEd963038113af313c24c1650e3Df67eeDD469F09"; 
coinFlip = new web3.eth.Contract(coinFlipABI, coinFlipAddress);

// Instantiate CoinFlipMulti contract
let coinFlipMulti;
const coinFlipMultiAddress = "0x2d4f5a2F4802eEE5A22A4fadC3b8ec87Bc90fB51";
coinFlipMulti = new web3.eth.Contract(coinFlipMultiABI, coinFlipMultiAddress);

// 1. Listener for CoinFlip.sol. Oracle is currently NOT using this listener.
const randomnessRequestListener = async () => {
    console.log("Listening for RequestRandomness events from CoinFlip.sol");
    const eventEmitter = coinFlip.events.RequestRandomness({
        fromBlock: 'latest' // 0 will show complete history since genesis
    });
    eventEmitter.on('data', async (event) => {
        console.log(event.returnValues.requestId, event.returnValues.blockNumber);
        const encodedHeaderHex = await rlpEncodeHeader(event.returnValues.blockNumber);
        console.log("RLP-encoded block header:", encodedHeaderHex);
        console.log("Waiting for fulfillRandomness(), usually included in immediate next block, can take a few...")
        await sendEncodedHeader(event.returnValues.requestId, encodedHeaderHex);
        console.log("Header successfully shipped back on-chain via callback.");
    });
}
//randomnessRequestListener(); // uncomment to run CoinFlip (single block) listener

// 1. Listener for CoinFlipMulti.sol. Oracle is currently using this listener.
const randomnessRequestListener2 = async () => {
    console.log("Listening for RequestRandomness events from CoinFlipMulti.sol");
    const eventEmitter = coinFlipMulti.events.RequestRandomness({
        fromBlock: 'latest' // 0 will show complete history since genesis
    });
    eventEmitter.on('data', async (event) => {
        console.log(event.returnValues.requestId);
        console.log("Block Number One:", event.returnValues.blockNumberOne);
        console.log("Block Number Two:", event.returnValues.blockNumberTwo);
        console.log("Block Number Three:", event.returnValues.blockNumberThree);

        const encodedHeaderHexOne = await rlpEncodeHeader(event.returnValues.blockNumberOne);
        console.log("RLP-encoded block header One:", encodedHeaderHexOne);
        const encodedHeaderHexTwo = await rlpEncodeHeader(event.returnValues.blockNumberTwo);
        console.log("RLP-encoded block header Two:", encodedHeaderHexTwo);
        const encodedHeaderHexThree = await rlpEncodeHeader(event.returnValues.blockNumberThree);
        console.log("RLP-encoded block header Three:", encodedHeaderHexThree);
        
        const encodedHeaders = [encodedHeaderHexOne, encodedHeaderHexTwo, encodedHeaderHexThree];

        console.log("Waiting for fulfillRandomness(), usually included in immediate next block, can take a few...")
        await sendMultipleEncodedHeaders(event.returnValues.requestId, encodedHeaders);
        console.log("Headers successfully shipped back on-chain via callback.");
    });
}
randomnessRequestListener2();


// 2. RLP encoder
async function rlpEncodeHeader(blockNumber) {

    // 1. Get the full block
    const block = await web3.eth.getBlock(blockNumber);

    // 2. Make array with only block header items.
    const blockHeader = [
        block.parentHash,
        block.sha3Uncles,
        block.miner,
        block.stateRoot,
        block.transactionsRoot, 
        block.receiptsRoot, 
        block.logsBloom,
        block.difficulty, 
        block.number,
        block.gasLimit,
        block.gasUsed,
        block.timestamp,
        block.extraData,
        block.mixHash,
        '0x0000000000000000', //block.nonce
        block.baseFeePerGas,
        block.withdrawalsRoot,
        block.blobGasUsed,
        block.excessBlobGas,
        block.parentBeaconBlockRoot,
    ];
    // 3. RLP encode the block header, turning it into uint8 array.
    const encodedHeader = RLP.encode(blockHeader); 

    // 4. Convert encoded header to a Buffer and then to hex so we can hash it.
    const encodedHeaderHex = '0x' + Buffer.from(encodedHeader).toString('hex'); 

    // 5. Verification: Hash the encodedHeaderHex to check the recreated block hash matches actual block.hash
    const recreatedBlockHash = ethers.keccak256(encodedHeaderHex);
    console.log("recreated block hash:", recreatedBlockHash);
    console.log("actual block hash:", block.hash);
    assert.deepStrictEqual(recreatedBlockHash, block.hash);
    return encodedHeaderHex;
}
//rlpEncodeHeader(5800000);

// 3. Ship single header on chain
async function sendEncodedHeader(requestId, encodedHeader) {
    const data = coinFlip.methods.fulfillRandomness(requestId, encodedHeader).encodeABI();
    const nonce = await web3.eth.getTransactionCount(account.address, 'latest');
    const tx = {
        from: account.address,
        to: coinFlipAddress,
        data: data,
        gas: 2000000,
        gasPrice: await web3.eth.getGasPrice(),
        nonce: nonce
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log('Transaction receipt:', receipt);
}

// 3. Ship multiple headers on chain
async function sendMultipleEncodedHeaders(requestId, encodedHeaders) {
    const data = coinFlipMulti.methods.fulfillRandomness(requestId, encodedHeaders).encodeABI();
    const nonce = await web3.eth.getTransactionCount(account.address, 'latest');
    const tx = {
        from: account.address,
        to: coinFlipMultiAddress,
        data: data,
        gas: 2000000,
        gasPrice: await web3.eth.getGasPrice(),
        nonce: nonce
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log('Transaction receipt:', receipt);
}


module.exports = {
    rlpEncodeHeader
};