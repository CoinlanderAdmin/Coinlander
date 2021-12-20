import {ethers} from "hardhat"
import ErrnoException = NodeJS.ErrnoException;
import * as fs from "fs";


async function main() {


  const [deployer] = await ethers.getSigners()
  // Deploy the NFT contract
  const Seekers = await ethers.getContractFactory("Seekers")
  const seekers = await Seekers.deploy()
  await seekers.deployed()
  console.log("Seeker contract address", seekers.address)

  // Deploy the Keepers Vault contract 
  const KeepersVault = await ethers.getContractFactory("KeepersVault")
  const keepersVault = await KeepersVault.deploy(seekers.address)
  await keepersVault.deployed()
  console.log("KeepersVault address", keepersVault.address)

  // Deploy the Coin contract 
  const SeasonOne = await ethers.getContractFactory("SeasonOne")
  const seasonOne = await SeasonOne.deploy(seekers.address, keepersVault.address)
  await seasonOne.deployed()
  console.log("CoinOne address", seasonOne.address)

  // Establish permissions for SeasonOne contract within Seekers contract
  await seekers.addGameContract(seasonOne.address)

  // Deploy the Nft Marketplace contract
  const ERC721Marketplace = await ethers.getContractFactory("ERC721Marketplace")
  const erc721Marketplace = await ERC721Marketplace.deploy()
  await erc721Marketplace.deployed()
  console.log("ERC721Marketplace address", erc721Marketplace.address)

  // Deploy the Sft Marketplace contract
  const ERC1155Marketplace = await ethers.getContractFactory("ERC1155Marketplace")
  const erc1155Marketplace = await ERC1155Marketplace.deploy()
  await erc1155Marketplace.deployed()
  console.log("ERC1155Marketplace address", erc1155Marketplace.address)

  // Build local json file. Used to store contract data
  const data = {
    contracts: {
      "seeker": seekers.address,
      "vault": keepersVault.address,
      "seasonOne": seasonOne.address,
      "nft-marketplace": erc721Marketplace.address,
      "sft-marketplace": erc1155Marketplace.address,
    }
  }
  const json = JSON.stringify(data, null, 2)
  fs.writeFileSync('artifacts/addresses.json', json, "utf8")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
