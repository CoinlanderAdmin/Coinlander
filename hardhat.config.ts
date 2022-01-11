import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import {HardhatUserConfig} from "hardhat/types"
import "tsconfig-paths/register"
import "hardhat-contract-sizer"
// import "@nomiclabs/hardhat-ganache";

import emulate from "./scripts/emulate";
import {task} from "hardhat/internal/core/config/config-env";
import fs from "fs";

task("emulate", "Play through the game.")
  .addParam("seizes", "The number of seizes to emulate.")
  .setAction(async (args, hre) => {
    const {seizes} = args
    await emulate(seizes, hre)
  })

const config: HardhatUserConfig = {
  solidity: "0.8.8",
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      allowUnlimitedContractSize: true,
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 31337,
    },
    ganache: {
      url: "http://localhost:8545",
      allowUnlimitedContractSize: true,
      gas: 1200000000,
      blockGasLimit: 1200000000,
      gasMultiplier: 10
    }
  },
  mocha: {
    timeout: 150000
  }
}
export default config
