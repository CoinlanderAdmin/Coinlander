import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import {HardhatUserConfig} from "hardhat/types"
import "tsconfig-paths/register"
import "hardhat-contract-sizer"

import emulate from "./scripts/emulate";
import emulateRinkArby from "./scripts/emulateRinkArby"
import {task} from "hardhat/internal/core/config/config-env";
import fs from "fs";

// Env handling: 
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "./.env") });
const owner: string | undefined = process.env.OWNER_KEY;
if (!owner) {
  throw new Error("Please set your OWNER_KEY in a .env file");
}
const userA: string | undefined = process.env.USERA_KEY;
if (!userA) {
  throw new Error("Please set your USERA_KEY in a .env file");
}
const userB: string | undefined = process.env.USERB_KEY;
if (!userB) {
  throw new Error("Please set your USERB_KEY in a .env file");
}

task("emulate", "Play through the game.")
  .addParam("seizes", "The number of seizes to emulate.")
  .setAction(async (args, hre) => {
    const {seizes} = args
    const {ethers} = hre
    await emulate(seizes, ethers)
  })

task("emulateRinkArby", "Play through the game.")
  .addParam("seizes", "The number of seizes to emulate.")
  .setAction(async (args, hre) => {
    const {seizes} = args
    const {ethers} = hre
    await emulateRinkArby(seizes, ethers)
  })

const config: HardhatUserConfig = {
  solidity: "0.8.8",
  networks: {
    localhost: {
      allowUnlimitedContractSize: true,
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 31337,
    },
    RinkArby: {
      url: "https://rinkeby.arbitrum.io/rpc",
      chainId: 421611,
      accounts: [owner,userA,userB]
    }
  },
  mocha: {
    timeout: 5000000
  }
}
export default config
