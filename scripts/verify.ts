import {ethers, hardhatArguments} from "hardhat"
import {HardhatEthersHelpers} from "hardhat/types"
import * as fs from "fs";
import * as logger from "../utils/logger"
import "@nomiclabs/hardhat-etherscan";


export async function verify() {
  
  logger.divider()
  logger.out('Attaching to contracts to verify', logger.Level.Info)
  logger.divider()

  const index: string = '2'
  const addressesJson = fs.readFileSync('addresses.json', 'utf8');
  const deployData = JSON.parse(addressesJson);
  const cloakLib = deployData['CloakLib']
  const addresses = deployData[index]

  // Get deployer 
  const [deployer, ...accounts] = await ethers.getSigners()


  // Attach to deployed contracts
  const Seekers = await ethers.getContractFactory("Seekers");
  const seekers = await Seekers.attach(addresses.contracts.seekers);
  const Vault = await ethers.getContractFactory("Vault")
  const vault = await Vault.attach(addresses.contracts.vault)
  const SeasonOne = await ethers.getContractFactory("SeasonOne")
  const seasonOne = await SeasonOne.attach(addresses.contracts.seasonOne)
  logger.pad(30, 'Seekers contract:', seekers.address)
  logger.pad(30, 'Vault contract:', vault.address)
  logger.pad(30, 'SeasonOne contract:', seasonOne.address)
  logger.divider()

  const hre = require("hardhat")
  // // Season One
  // await hre.run("verify:verify", {
  //   address: seasonOne.address,
  //   constructorArguments: [
  //     seekers.address,
  //     vault.address
  //   ],
  // })

  // Seekers
  await hre.run("verify:verify", {
    address: seekers.address,
    constructorArguments: [
      cloakLib
    ]})
  
  // Vault 
  await hre.run("verify:verify", {
    address: vault.address,
    constructorArguments: [
      deployer.address
    ]})

}

verify()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
