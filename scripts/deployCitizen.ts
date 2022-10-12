import {ethers} from "hardhat"
import * as fs from "fs";
import * as logger from "../utils/logger"
import * as git from "../utils/gitHelpers"
import { Cloak__factory, Cloak} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { envConfig } from "../utils/env.config";


// Shared libraries defined in a global scope 
let CloakLib: Cloak__factory
let cloak: Cloak
let deployer: SignerWithAddress

export async function deployCitizens() {
  let data: any = {}

  const network = await ethers.provider.getNetwork()

  const addressesJson = fs.readFileSync('addresses.json', 'utf8');
  const deployData = JSON.parse(addressesJson);
  const addresses = deployData[network.chainId]

  logger.divider()
  logger.out("Deploying to: " + network.name, logger.Level.Info)
  logger.out("With chain id: " + network.chainId, logger.Level.Info)
  
  logger.divider()
  logger.out("Attaching to libraries...", logger.Level.Info)
  CloakLib = await ethers.getContractFactory("Cloak")
  cloak = await CloakLib.attach(addresses.CloakLib) 
  logger.pad(30, "Cloak library attached at: " + cloak.address)


  
  logger.divider()
  logger.out('Starting contract deploy...', logger.Level.Info)
  logger.divider()

  const deployBlock = await (await ethers.provider.getBlock("latest")).number
  logger.out(deployBlock)

  // Deploy the NFT contract
  const Citizens = await ethers.getContractFactory("Citizens")
  logger.out("Got contract factory")
  const citizens = await Citizens.deploy(cloak.address)
  logger.pad(30, "Citizens contract deployed to: ", citizens.address)
  //writeAddressesJson(data)

  // await git.commitAndTagRelease(network.chainId)    
}

function writeAddressesJson(data: object){
  logger.divider()
  logger.out('Exporting contract address data...')
  logger.divider()

  // Build local json file. Used to store address contract data
  const json = JSON.stringify(data, null, 2)
  fs.writeFileSync('addresses.json', json, "utf8")

}


deployCitizens()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
