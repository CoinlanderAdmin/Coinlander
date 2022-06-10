import {ethers} from "hardhat"
import * as fs from "fs";
import * as logger from "../utils/logger"

export async function deploy() {
  logger.divider()
  logger.out('Starting contract deploy...', logger.Level.Info)
  logger.divider()

  const [deployer] = await ethers.getSigners()

  // Deploy the NFT contract
  const Seekers = await ethers.getContractFactory("Seekers")
  const seekers = await Seekers.deploy()
  await seekers.deployed()
  logger.pad(30, 'Seekers contract:', seekers.address)

  // Deploy the Keepers Vault contract 
  const Vault = await ethers.getContractFactory("Vault")
  const vault = await Vault.deploy()
  await vault.deployed()
  logger.pad(30, 'Vault contract:', vault.address)

  // Deploy the Coin contract 
  const SeasonOne = await ethers.getContractFactory("SeasonOne")
  const seasonOne = await SeasonOne.deploy(seekers.address, vault.address)
  await seasonOne.deployed()
  logger.pad(30, 'SeasonOne contract:', seasonOne.address)

  // Establish permissions for SeasonOne contract within Seekers contract
  await seekers.addGameContract(seasonOne.address)

  // Set SeasonOne contract as owner of vault contract
  await vault.transferOwnership(seasonOne.address)

  // Deploy the Nft Marketplace contract
  const ERC721Marketplace = await ethers.getContractFactory("ERC721Marketplace")
  const erc721Marketplace = await ERC721Marketplace.deploy()
  await erc721Marketplace.deployed()
  logger.pad(30, 'ERC721Marketplace contract:', erc721Marketplace.address)

  // Deploy the Sft Marketplace contract
  const ERC1155Marketplace = await ethers.getContractFactory("ERC1155Marketplace")
  const erc1155Marketplace = await ERC1155Marketplace.deploy()
  await erc1155Marketplace.deployed()
  logger.pad(30, 'ERC1155Marketplace contract:', erc1155Marketplace.address)

  logger.divider()
  logger.out('Exporting contract address data...')
  logger.divider()

  // Build local json file. Used to store address contract data
  const data = {
    contracts: {
      "seekers": seekers.address,
      "vault": vault.address,
      "seasonOne": seasonOne.address,
      "nftMarketplace": erc721Marketplace.address,
      "sftMarketplace": erc1155Marketplace.address,
    }
  }
  const json = JSON.stringify(data, null, 2)
  fs.writeFileSync('local/addresses.json', json, "utf8")

  logger.out('Deploy complete!', logger.Level.Info)
  logger.divider()
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
