import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import { HardhatUserConfig } from "hardhat/types"
import "tsconfig-paths/register"
import "hardhat-contract-sizer"

const config: HardhatUserConfig = {
    solidity: "0.8.8",
    networks: {
        localhost  : {
            allowUnlimitedContractSize: true,
        },
        hardhat  : {
            allowUnlimitedContractSize: true,
            chainId: 31337,
        },
    },
    mocha: {
        timeout: 150000
    }
}

export default config
