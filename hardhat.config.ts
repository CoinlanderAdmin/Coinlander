import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import { HardhatUserConfig } from "hardhat/types"
import "tsconfig-paths/register"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer"
const config: HardhatUserConfig = {
    solidity: "0.8.8",
    networks: {
        localhost  : {
            gas: 300000000000
        }
    }
}

export default config
