import {HardhatEthersHelpers} from "hardhat/types"
import * as fs from "fs";
import * as logger from "../utils/logger"
import "@nomiclabs/hardhat-etherscan";


async function CLverify(instance: string, ethers: HardhatEthersHelpers) {
  
  const addressesJson = fs.readFileSync('addresses.json', 'utf8');
  const deployData = JSON.parse(addressesJson);
  const cloakLib: string  = deployData['CloakLib']


  // Get deployer 
  const [deployer, ...accounts] = await ethers.getSigners()

  const hre = require("hardhat")

  // Verify common libs 
  const CloakLib = await ethers.getContractFactory("Cloak")
  const cloak = await CloakLib.attach(cloakLib)
  // Cloak Lib 
  // await hre.run("verify:verify", {
  //   address: cloak.address,
  //   constructorArguments: []
  // })

  let addresses 
  addresses = deployData[instance]
  logger.pad(30, "Starting verification for instance: ", instance)

  
  // Attach to deployed contracts
  const Seekers = await ethers.getContractFactory("Seekers")
  const seekers = await Seekers.attach(addresses.contracts.seekers)
  const Vault = await ethers.getContractFactory("Vault")
  const vault = await Vault.attach(addresses.contracts.vault)
  const SeasonOne = await ethers.getContractFactory("SeasonOne")
  const seasonOne = await SeasonOne.attach(addresses.contracts.seasonOne)
  logger.pad(30, 'Seekers contract:', seekers.address)
  logger.pad(30, 'Vault contract:', vault.address)
  logger.pad(30, 'SeasonOne contract:', seasonOne.address)
  logger.divider()

  // Season One
  await hre.run("verify:verify", {
    address: seasonOne.address,
    constructorArguments: [
      seekers.address,
      vault.address
    ],
  })

  // Seekers
  await hre.run("verify:verify", {
    address: seekers.address,
    constructorArguments: [
      cloak.address
    ]})
  
  // Vault 
  await hre.run("verify:verify", {
    address: vault.address,
    constructorArguments: [
      deployer.address
    ]})
  

}

export default CLverify