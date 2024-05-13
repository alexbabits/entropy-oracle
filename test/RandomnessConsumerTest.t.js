const { expect } = require("chai");
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { rlpEncodeHeader } = require("../oracle/oracle.js");
//@audit incomplete tests
const sepoliaBlock = 5800000; // Cancun era
const sepoliaHash5800000 = "0x4d6a121cdf8f179e5e39c9d655db44ab09f3cb4fa2e7fa3115a82c2d26087dbb";
const sepoliaMixHash5800000 = "0xb037651659a55626fb7daff00d16eb011ec0c6fd7a6c395f8e75421b90ec77b3";

// Must change `hardhat.config.js` to mainnet to use mainnet values
const mainnetBlock = 19800000; // Cancun era
const mainnetHash19800000 = "0x95d7f597b43f97bb4dcb0f1d9a74f13d6d6236592cd01d122945d04b5a2aabad";
const mainnetMixHash19800000 = "0xb50774a2180b910c41018b5651e87200c3d10c7b7cd0443b20e346b3f289b66a";

describe("CoinFlip contract", function () {

  async function CoinFlipLockFixture() {
    const coinFlip = await ethers.deployContract("CoinFlip");
    return { coinFlip };
  }

  it("Should get block hash", async function () {
    const { coinFlip } = await loadFixture(CoinFlipLockFixture);
    const hash = await coinFlip.getBlockHash(sepoliaBlock);
    expect(hash).to.equal(sepoliaHash5800000);
  });

  it("Should verify and extract mixHash, given a block and RLP-encoded header", async function () {
    const { coinFlip } = await loadFixture(CoinFlipLockFixture);
    const encodedHeaderHex = await rlpEncodeHeader(sepoliaBlock);
    const randao = await coinFlip.getRandao(sepoliaBlock, encodedHeaderHex); 
    expect(randao).to.equal(sepoliaMixHash5800000);
  });

});