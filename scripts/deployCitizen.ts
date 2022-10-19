import {ethers} from "hardhat"
import * as fs from "fs";
import * as logger from "../utils/logger"
import * as git from "../utils/gitHelpers"
import { Cloak__factory, Cloak} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


// Shared libraries defined in a global scope 
let CloakLib: Cloak__factory
let cloak: Cloak
let deployer: SignerWithAddress

export async function deployFormers() {
  let data: any = {}

  const network = await ethers.provider.getNetwork()

  const addressesJson = fs.readFileSync('addresses.json', 'utf8');
  const allData = JSON.parse(addressesJson);
  const chainData = allData[network.chainId]

  logger.divider()
  logger.out("Deploying to: " + network.name, logger.Level.Info)
  logger.out("With chain id: " + network.chainId, logger.Level.Info)
  
  logger.divider()
  logger.out("Attaching to libraries...", logger.Level.Info)
  CloakLib = await ethers.getContractFactory("Cloak")
  try {
    cloak = await CloakLib.attach(chainData.CloakLib) 
    logger.pad(30, "Cloak library attached at: " + cloak.address)
  }
  catch {
    cloak = await CloakLib.deploy()
    logger.pad(30, "Cloak library deployed to: " + cloak.address)
    chainData["CloakLib"] = cloak.address
  }
  
  logger.divider()
  logger.out('Starting contract deploy...', logger.Level.Info)
  logger.divider()

  const deployBlock = await (await ethers.provider.getBlock("latest")).number
  logger.pad(30, 'Deploying at block height: ', deployBlock)

  // Deploy the NFT contract
  const Formers = await ethers.getContractFactory("Formers")
  logger.out("Got contract factory")
  const formers = await Formers.deploy(cloak.address)
  logger.pad(30, "Formers contract deployed to: ", formers.address)
  chainData["0"]["contracts"]["formers"] = formers.address

  allData[network.chainId] = chainData
  writeAddressesJson(allData)

  if(network.chainId != 31337) { // dont tag deploys to localhost
    await git.commitAndTagRelease(network.chainId)  
  }
}

function writeAddressesJson(data: object) {
  logger.divider() 
  logger.out('Exporting contract address data...')
  logger.divider()

  // Build local json file. Used to store address contract data
  const json = JSON.stringify(data, null, 2)
  fs.writeFileSync('addresses.json', json, "utf8")
}


deployFormers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
