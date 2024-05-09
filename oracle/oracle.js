const assert = require('assert');
const RLP = require('rlp');
const { ethers } = require("ethers");
const { Web3 } = require('web3');
require("dotenv").config({ path: '../.env' }); 
const rcABI = require("../artifacts/src/RandomnessConsumer.sol/RandomnessConsumer.json").abi;

// Connect to provider (HTTPS) --> `const web3 = new Web3(process.env.RPC_URL);`
// Connect to provider (websocket):
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WS_RPC_URL));

// Create signer
const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);

// Instantiate RandomnessConsumer contract
let rc;
const rcAddress = "0xe5c2814Ff025BCb4219960Ab6E1bA89bf016AEF5";
rc = new web3.eth.Contract(rcABI, rcAddress);

// 1. Listener
const randomnessRequestListener = async () => {
    console.log("Listening for RequestRandomness events from RandomnessConsumer.sol");
    const eventEmitter = rc.events.RequestRandomness({
        fromBlock: 'latest' 
    });
    eventEmitter.on('data', async (event) => {
        console.log(event.returnValues.requestId, event.returnValues.blockNumber);
        const encodedHeaderHex = await rlpEncodeHeader(event.returnValues.blockNumber);
        console.log("RLP-encoded block header:", encodedHeaderHex);
        await sendEncodedHeader(event.returnValues.requestId, encodedHeaderHex);
        console.log("Header shipped.");
    });
}
randomnessRequestListener();

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


// 3. Ship header on chain
async function sendEncodedHeader(requestId, encodedHeader) {
    const data = rc.methods.fulfillRandomness(requestId, encodedHeader).encodeABI();
    const nonce = await web3.eth.getTransactionCount(account.address, 'latest');
    const tx = {
        from: account.address,
        to: rcAddress,
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

/*
// ************* RLP encode basics ****************

function rlpEncodeOne() {
    const item = "cat";
    const encodedItem = RLP.encode(item);
    const decodedItem = RLP.decode(encodedItem);
    const decodedString = Buffer.from(decodedItem).toString();
    assert.deepStrictEqual(item, decodedString);
    console.log("item:", item);
    console.log("encodedItem:", encodedItem);
    console.log("decodedITem:", decodedItem);
    console.log("decodedString:", decodedString);
}
//rlpEncodeOne();


function rlpEncodeTwo() {
    const items = ["cat", "dog"];
    const encodedItems = RLP.encode(items);
    const decodedItems = RLP.decode(encodedItems);
    const decodedStrings = decodedItems.map(item => Buffer.from(item).toString());
    assert.deepStrictEqual(items, decodedStrings);
    console.log("items:", items);
    console.log("encodedItems:", encodedItems);
    console.log("decodedItems:", decodedItems);
    console.log("decodedStrings:", decodedStrings);
}
//rlpEncodeTwo();


// ************* OLD block.hash methods ***************


// [17034870, 19426586] inclusive. Shanghai-Capella --> Cancun-Deneb
async function verifyShanghaiToCancunHash() {

    // 1. Get the full block
    const block = await web3.eth.getBlock(19010121);
    console.log(block.hash); // '0x8576cd4900e56c1214e2f32fbb194c0ebddde8cffd243194187977583d712aa5'

    // 2. Make array with only block header items.
    const blockHeader = [
        block.parentHash, // '0x0607c9891abee48a5d70948d61d41ef7cabe554a8dd1aec49c6322ba7e2fab25'
        block.sha3Uncles, // '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347'
        block.miner, // '0x95222290dd7278aa3ddd389cc1e1d165cc4bafe5'
        block.stateRoot, // '0x0f90554fb8e825ce12c6ad7f0d5564e0197d6b41b4d6cf2a65175373795ef1fa'
        block.transactionsRoot, // '0xce8641939cdf1811521940f78609856d43a8eaf4e7b5c0a48e24c242cd57ec4b'
        block.receiptsRoot, // '0x52c2389675794511f8787f7a999019d9bfe9bfa9c6ec3b8544592241387d52aa'
        block.logsBloom, // '0x10a1d45047215b70ca08a790aa40920729bb9280ea453316106f832056a109a0193404ed0c01026300305933a870495813258a488813a4b8669d4644c0682180910ab60909c48d0a6b83c04e022c34f06199085db4fe19811143e213c832cd7209850550260ec14204c22a0c64646f020a30a8c01e008400c61621d4420850566032045603891962784d03d201620734430308930fb9130804c201437b700c622f43b1da4c80600365c04c86f8800cc40602a42103bc00222131a90601ce040055044e035af412610422ba2310c80a4c2dc023729669081405df1546c10120130098e001394c0102286c50252810ad44dea07930211814440a009c3c80630c21'
        block.difficulty, // 0n ('0x')
        block.number, // 19010121n ('0x1221249')
        block.gasLimit, // 30000000n ('0x1c9c380')
        block.gasUsed, // 12044352n ('0xb7c840')
        block.timestamp, // 1705295603n ('0x65a4bef3')
        block.extraData, // '0x6265617665726275696c642e6f7267'
        block.mixHash, // '0x84376d868db109d93e3062b04daa8a4f50e8ac872a0807eb740d306a395dc7d6'
        '0x0000000000000000', //block.nonce MUST BE 16 ZEROs IN THIS ERA!
        block.baseFeePerGas, // 16698450961n ('0x3e34e2411')
        block.withdrawalsRoot, // '0x3e72aaa4c11c1c04da24b4e2e40709b8a0795e877997921ab5806acd890c1054'
    ];
    console.log(blockHeader);

    // 3. RLP encode the block header, turning it into uint8 array with 534 entries.
    const encodedHeader = RLP.encode(blockHeader); 
    console.log(encodedHeader);

    // 4. Convert encoded header to a Buffer and then to hex so we can hash it.
    const encodedHeaderHex = Buffer.from(encodedHeader).toString('hex'); 
    console.log(encodedHeaderHex);

    // 5. Hash the encodedHex to verify block hash
    const recreatedBlockHash = ethers.keccak256('0x' + encodedHeaderHex);
    console.log(recreatedBlockHash);
    assert.deepStrictEqual(recreatedBlockHash, block.hash); // Successfully matches the actal block hash!
  }
//verifyShanghaiToCancunHash();


// [15537394, 17034869] inclusive. Paris --> Shanghai
async function verifyHashParisToShanghai() {

    // 1. Get the full block
    const block = await web3.eth.getBlock(16000000); 
    console.log(block.hash); // '0x3dc4ef568ae2635db1419c5fec55c4a9322c05302ae527cd40bff380c1d465dd'

    // 2. Make array with only block header items.
    const blockHeader = [
        block.parentHash, // '0x6f377dc6bd1f3e38b9ceb8c946a88c13211fa3f084622df3ee5cfcd98cc6bb16'
        block.sha3Uncles, // '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347'
        block.miner, // '0xebec795c9c8bbd61ffc14a6662944748f299cacf'
        block.stateRoot, // '0xe5608defce0c3e193b4c2e3452ece5158e6ae35db211925cdfb4cd307587bbf0'
        block.transactionsRoot, // '0xe0265e44b4639453428546d1c0046c9fbba7d679b7be3e67692904c776389890'
        block.receiptsRoot, // '0x63c77297d9aace97c33e40c07c4f7d52f62e898f9be74f43ae8f8b751012e719'
        block.logsBloom, // '0xdaa80d34c104520cb02c181aa334f26395a0512141a85800c11d8c0c9d7729450f0c5312194a10655d72ba6542aab72f070146682f1ae981e663c1ff58eaedc266044692052ab00e7eaed34b60b26cf85003080153c602690e38ac619e4461431ac01d6c5a070e28c9469e006a90999175badc76a93b2e3a56b300d8ca9e18108e22c319caa21081184b494880923617c1800cf95b24904be3a48079c4526582fee283c1100ae8112239a1c908ae804a4dc178cee0248d8215a33d0c91c895555194c1abe11124dd81c09a02018fa22e4de90fcb90db62160058bb02c0b46054603eb1889038316a1211de9010db1bd1971c0085cc2c1642100f096618daf833'
        block.difficulty, // 0n ('0x')
        block.number, // 16000000n ('0xf42400')
        block.gasLimit, // 30000000n ('0x1c9c380')
        block.gasUsed, // 18992639n ('0x121cdff')
        block.timestamp, // 1668811907n ('0x63780c83')
        block.extraData, // '0x4d616465206f6e20746865206d6f6f6e20627920426c6f636b6e6174697665'
        block.mixHash, // '0xe197021bc2912013a6c5e3a42fa1260f00d80ad389a9f7137a5dafdaef38977a'
        '0x0000000000000000', // block.nonce. MUST HAVE 16 ZEROs IN THIS ERA
        block.baseFeePerGas, // 11130414489n ('0x2976ca599')
    ];
    console.log(blockHeader);

    // 3. RLP encode the block header, turning it into uint8 array.
    const encodedHeader = RLP.encode(blockHeader); 
    console.log(encodedHeader);

    // 4. Convert encoded header to a Buffer and then to hex so we can hash it.
    const encodedHeaderHex = Buffer.from(encodedHeader).toString('hex'); 
    console.log(encodedHeaderHex);

    // 5. Hash the encodedHeaderHex to verify block hash
    const recreatedBlockHash = ethers.keccak256('0x' + encodedHeaderHex);
    console.log(recreatedBlockHash);
    assert.deepStrictEqual(recreatedBlockHash, block.hash); // Successfully matches the actal block hash!
  }
//verifyHashParisToShanghai();



// [12965000, 15537393] inclusive. London --> Paris (The Merge).
async function verifyHashLondonToParisBlocks() {

    // 1. Get the full block
    const block = await web3.eth.getBlock(14000000); 
    console.log(block.hash); // '

    // 2. Make array with only block header items.
    const blockHeader = [
        block.parentHash, // '0x0c9ef41f038aa58a4aa2810fda03d9d82aac9082c80283230fd74cb1cceb4b00'
        block.sha3Uncles, // '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347'
        block.miner, // '0xea674fdde714fd979de3edf0f56aa9716b898ec8'
        block.stateRoot, // '0xfb3df73e7a41d500a374ee236dd613bb24f1a5fa5b80615a7953ea75c26c6a6d'
        block.transactionsRoot, // '0x16b6ff83df3ef14f614c70ac29e8a05d102c6bed0e5882c284abf0120b89529c'
        block.receiptsRoot, // '0xf7b9f8e92a4b420a27302ab91084e5499d3d711183a021f4956ff32de246e14e'
        block.logsBloom, // '0x083815041300081040f485088003de10046040491c3c0164189830ca3c2c0d1121040493008ba600924849820c8901130b0084038802610706000b6101b220d01210000400020b08480850880d0226a04024e107005114513410021080080451126063400a1084021c62bc08290008a0430081540c892545360c401410194021426103228249162800ac016601100d0520b96203432080086a00424d8214010b63180471318634d0ae00108041a1184488a10841a2610e0401e9001a504a4010098182020808155027009c02008e56070c28728114480490400801cac010290ae291a00ca0408b60204c128012601c100a24cc01e100897242832a825000c1e1'
        block.difficulty, // 12316581093827601n ('0x2bc1dd80f1e411')
        block.number, // 14000000n ('0xd59f80')
        block.gasLimit, // 30058561n ('0x1caa841')
        block.gasUsed, // 8119826n ('0x7be612')
        block.timestamp, // 1642114795n ('0x61e0aeeb')
        block.extraData, // '0x6175737472616c69612d736f75746865617374312d31'
        block.mixHash, // '0xa832679fcf3e71f0b29bd5913955151be5bf1fc59e135e3c7eb6e30f8442a5df'
        block.nonce, // 3596099692050383908n ('0x31e7e99df18e0424')
        block.baseFeePerGas, // 139541559304n ('0x207d533808')
    ];
    console.log(blockHeader);

    // 3. RLP encode the block header, turning it into uint8 array.
    const encodedHeader = RLP.encode(blockHeader); 
    console.log(encodedHeader);

    // 4. Convert encoded header to a Buffer and then to hex so we can hash it.
    const encodedHeaderHex = Buffer.from(encodedHeader).toString('hex'); 
    console.log(encodedHeaderHex);

    // 5. Hash the encodedHeaderHex to verify block hash
    const recreatedBlockHash = ethers.keccak256('0x' + encodedHeaderHex);
    console.log(recreatedBlockHash);
    assert.deepStrictEqual(recreatedBlockHash, block.hash); // Successfully matches the actal block hash!
  }
//verifyHashLondonToParisBlocks();


// [1, 12964999] inclusive. Genesis --> London. 
async function verifyHashGenesisToLondonBlocks() {

    // 1. Get the full block
    const block = await web3.eth.getBlock(400000);
    console.log(block.hash); // '0x5d15649e25d8f3e2c0374946078539d200710afc977cdfc6a977bd23f20fa8e8'

    // 2. Make array with only block header items.
    const blockHeader = [
        block.parentHash, // '0x1e77d8f1267348b516ebc4f4da1e2aa59f85f0cbd853949500ffac8bfc38ba14'
        block.sha3Uncles, // '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347'
        block.miner, // '0x2a65aca4d5fc5b5c859090a6c34d164135398226'
        block.stateRoot, // '0x0b5e4386680f43c224c5c037efc0b645c8e1c3f6b30da0eec07272b4e6f8cd89'
        block.transactionsRoot, // '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421'
        block.receiptsRoot, // '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421'
        block.logsBloom, // '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
        block.difficulty, // 6022643743806n ('0x57a418a7c3e')
        block.number, // 400000n ('0x61a80')
        block.gasLimit, // 3141592n ('0x2fefd8')
        block.gasUsed, // 0n ('0x')
        block.timestamp, // 1445130204n ('0x5622efdc')
        block.extraData, // '0xd583010202844765746885676f312e35856c696e7578'
        block.mixHash, // '0x3fbea7af642a4e20cd93a945a1f5e23bd72fc5261153e09102cf718980aeff38'
        block.nonce // 7706288617141211887n ('0x6af23caae95692ef')
    ];
    console.log(blockHeader);

    // 3. RLP encode the block header, turning it into uint8 array.
    const encodedHeader = RLP.encode(blockHeader); 
    console.log(encodedHeader);

    // 4. Convert encoded header to a Buffer and then to hex so we can hash it.
    const encodedHeaderHex = Buffer.from(encodedHeader).toString('hex'); 
    console.log(encodedHeaderHex);

    // 5. Hash the encodedHeaderHex to verify block hash
    const recreatedBlockHash = ethers.keccak256('0x' + encodedHeaderHex);
    console.log(recreatedBlockHash);
    assert.deepStrictEqual(recreatedBlockHash, block.hash); // Successfully matches the actal block hash!
  }
//verifyHashGenesisToLondonBlocks();

*/