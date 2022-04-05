import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import {HardhatUserConfig} from "hardhat/types"
import "tsconfig-paths/register"
import "hardhat-contract-sizer"
import "@nomiclabs/hardhat-etherscan"
import { envConfig } from "./utils/env.config" 
import emulate from "./scripts/emulate";
import {task} from "hardhat/internal/core/config/config-env";

task("emulate", "Play through the game.")
  .addParam("seizes", "The number of seizes to emulate.")
  .setAction(async (args, hre) => {
    const {seizes} = args
    const {ethers} = hre
    await emulate(seizes, ethers)
  })

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true, 
        runs: 200
      }
    }
  },
  networks: {
    localhost: {
      allowUnlimitedContractSize: true,
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 31337,
    },
    RinkArby: {
      url: envConfig.RinkArbyKey,
      chainId: 421611,
      //gas: 900000,
      accounts: [envConfig.owner, envConfig.userA, envConfig.userB]
    },
    Rinkeby: {
      url: envConfig.RinkebyKey,
      chainId: 4,
      accounts: [envConfig.owner, envConfig.userA, envConfig.userB]
    }
  },
  etherscan: {
    apiKey: {
      arbitrumOne: envConfig.ArbiscanAPIKey
    }
  },
  mocha: {
    timeout: 5000000
  }
}

export default config
