import {ethers} from "hardhat"
import * as fs from "fs";
import * as logger from "./logger"

export async function deploy() {
  let data: any = {}

  let revision = require('child_process')
  .execSync('git rev-parse HEAD')
  .toString().trim()

  console.log(revision)
  
  for(let i = 0; i < 3; i ++){
    logger.divider()
    logger.out('Starting contract deploy...', logger.Level.Info)
    logger.divider()

    const [deployer] = await ethers.getSigners()
    const deployBlock = await (await ethers.provider.getBlock("latest")).number

    // Deploy the NFT contract
    const Seekers = await ethers.getContractFactory("Seekers")
    const seekers = await Seekers.deploy()
    await seekers.deployed()
    logger.pad(30, 'Seekers contract:', seekers.address)

    // Deploy the Keepers Vault contract 
    const Vault = await ethers.getContractFactory("Vault")
    const vault = await Vault.deploy(seekers.address)
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
    data[i] = {
      "deployBlock": deployBlock,
      contracts: {
        "seekers": seekers.address,
        "vault": vault.address,
        "seasonOne": seasonOne.address
      }
    }

  }
  logger.divider()
  logger.out('Exporting contract address data...')
  logger.divider()

  // Build local json file. Used to store address contract data
  
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
