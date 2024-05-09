require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-foundry");
require("dotenv").config();

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.RPC_URL, // currently sepolia
        blockNumber: 5800000  // sepolia block
      }
    }
  },
  solidity: "0.8.23",
};