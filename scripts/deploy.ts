import {ethers} from "hardhat"
import * as fs from "fs";
import * as logger from "../utils/logger"
import * as git from "../utils/gitHelpers"
import { hrtime } from "process";
import { Cloak__factory, Cloak} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


// Shared libraries defined in a global scope 
let CloakLib: Cloak__factory
let cloak: Cloak
let deployer: SignerWithAddress

export async function deploy() {
  let data: any = {}

  const hre = require("hardhat")

  const network = await ethers.provider.getNetwork()

  logger.divider()
  logger.out("Deploying to: " + network.name, logger.Level.Info)
  logger.out("With chain id: " + network.chainId, logger.Level.Info)
  
  logger.divider()
  logger.out("Deploying libraries...", logger.Level.Info)
  CloakLib = await ethers.getContractFactory("Cloak")
  cloak = await CloakLib.deploy() 
  data["CloakLib"] = cloak.address
  logger.pad(30, "Cloak library deployed to: " + cloak.address)

  // When deploying to RinkArby testnet, make three copies and store the json blob locally for testing 
  if(network.chainId == 421611) {

    for(let i = 0; i < 3; i ++){
      data[i] = await deploySeasonOne()
    }
    logger.out('Deploy complete!', logger.Level.Info)
    logger.divider()

    writeAddressesJson(data)

    git.commitAndTagRelease(network.chainId)    
  }

  // When deploying to Arbitrum One, only deploy once
  else if(network.chainId == 42161){

    data[0] = await deploySeasonOne()
    logger.out('Deploy complete!', logger.Level.Info)
    logger.divider()

    writeAddressesJson(data)

    git.commitAndTagRelease(network.chainId)  
  }

  else {
     await deploySeasonOne()
  }
}

function writeAddressesJson(data: object){
  logger.divider()
  logger.out('Exporting contract address data...')
  logger.divider()

  // Build local json file. Used to store address contract data
  const json = JSON.stringify(data, null, 2)
  fs.writeFileSync('addresses.json', json, "utf8")

}

async function deploySeasonOne() {
  
  logger.divider()
  logger.out('Starting contract deploy...', logger.Level.Info)
  logger.divider()

  const deployBlock = await (await ethers.provider.getBlock("latest")).number
  const [deployer, ...accounts] = await ethers.getSigners()

  logger.out(deployBlock)

  // Deploy the NFT contract
  const Seekers = await ethers.getContractFactory("Seekers")
  logger.out("Got contract factory")
  const seekers = await Seekers.deploy(cloak.address)
  
  logger.out("Sent deployment to chain")
  await seekers.deployed()
  logger.pad(30, 'Seekers contract:', seekers.address)


  // Deploy the Keepers Vault contract 
  const Vault = await ethers.getContractFactory("Vault")
  // @TODO we need to set up our Oracle and add the address to the env
  const vault = await Vault.deploy(deployer.address)
  await vault.deployed()
  logger.pad(30, 'Vault contract:', vault.address)

  // Deploy the SeasonOne contract 
  const SeasonOne = await ethers.getContractFactory("SeasonOne")
  const seasonOne = await SeasonOne.deploy(seekers.address, vault.address)
  await seasonOne.deployed()
  logger.pad(30, 'SeasonOne contract:', seasonOne.address)

  // Establish permissions for SeasonOne contract within Seekers contract
  await seekers.addGameContract(seasonOne.address)

  // Set SeasonOne contract as minter for vault contract
  await vault.setGameContract(seasonOne.address)

  var deployBlob = {
    "deployBlock": deployBlock,
    contracts: {
      "seekers": seekers.address,
      "vault": vault.address,
      "seasonOne": seasonOne.address
    }
  }

  return deployBlob
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
