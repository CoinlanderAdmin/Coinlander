import { run, ethers } from "hardhat"

async function main() {


  const [deployer] = await ethers.getSigners()
  // Deploy the NFT contract
  const Seekers = await ethers.getContractFactory("Seekers")
  const seekers = await Seekers.deploy()
  await seekers.deployed()
  console.log("Seeker contract address", seekers.address)

  // Deploy the Coin contract 
  const CoinOne = await ethers.getContractFactory("CoinOne")
  const coinOne = await CoinOne.deploy(seekers.address)
  await coinOne.deployed()
  console.log("CoinOne address", coinOne.address)

  // Deploy the Coin contract 
  const KeepersVault = await ethers.getContractFactory("KeepersVault")
  const keepersVault = await KeepersVault.deploy(seekers.address)
  await keepersVault.deployed()
  console.log("KeepersVault address", keepersVault.address)

  coinOne._initKeepersVault(keepersVault.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
