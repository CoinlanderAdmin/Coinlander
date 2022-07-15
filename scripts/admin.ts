import {ethers} from "hardhat"
import { envConfig } from "../utils/env.config" 
import * as fs from "fs";
import * as logger from "../utils/logger"
import { BigNumber } from "ethers";

export async function postDeployAdmin() {
  logger.divider()
  logger.out('Attaching to contracts...', logger.Level.Info)
  logger.divider()

  const index: string = '1'
  const addressesJson = fs.readFileSync('addresses.json', 'utf8');
  const deployData = JSON.parse(addressesJson);
  const addresses = deployData[index]
  const network = await ethers.provider.getNetwork()

  let env: string
  if(network.chainId == 42161) {
    env = "one"
  }
  else {
    env = "dev"
  }

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

  // Metadata Controls
  // Change Seeker metadata URI 
  logger.out('Checking seeker _baseURI...')
  let newSeekerBaseURI = `https://api.coinlander.${env}/meta/seekers/`
  let seekersCurrentURI = await seekers.tokenURI(1) // there will always be a token id: 1
  logger.pad(30, 'Current URI for token 1:', seekersCurrentURI)
  if(seekersCurrentURI != (newSeekerBaseURI + "1")) {
    await seekers.setBaseURI(newSeekerBaseURI)
    seekersCurrentURI = await seekers.tokenURI(1) 
    logger.pad(30, 'New URI for token 1:', seekersCurrentURI)
  }
  else {
    logger.out('URI already set correctly')
  }
  logger.divider()

  // Change SeasonOne contract URI 
  logger.out('Checking Season One contract URI...')
  let newSOneBaseURI = `https://api.coinlander.${env}/meta/season-one`
  let sOneCurrentURI = await seasonOne.contractURI() 
  logger.pad(30, 'Current URI for season one contract:', sOneCurrentURI)
  if(sOneCurrentURI != newSOneBaseURI) {
    await seasonOne.setContractURI(newSOneBaseURI)
    sOneCurrentURI = await seasonOne.contractURI() 
    logger.pad(30, 'New contract URI for season one contract:', sOneCurrentURI)
  }
  else {
    logger.out('URI already set correctly')
  }
  logger.divider()

  // Change SeasonOne token URI
  logger.out('Checking Season One token URI...')
  let newSOneTokenURI = `https://api.coinlander.${env}/meta/season-one/{id}`
  let sOneTokenURI = await seasonOne.uri(1)
  logger.pad(30, 'Current URI for season one tokens:', sOneTokenURI)
  if(sOneTokenURI != newSOneTokenURI) {
    await seasonOne.changeURI(newSOneTokenURI)
    sOneTokenURI = await seasonOne.uri(1) 
    logger.pad(30, 'New token URI for season one contract:', sOneTokenURI)
  }
  else {
    logger.out('URI already set correctly')
  }
  logger.divider()


  // Change Vault contract URI
  logger.out('Checking Vault contract URI...')
  let newVaultContractURI = `https://api.coinlander.${env}/meta/vault`
  let vaultContractURI = await vault.contractURI() 
  logger.pad(30, 'Current URI for vault contract:', vaultContractURI)
  if(vaultContractURI != newVaultContractURI) {
    await vault.setContractURI(newVaultContractURI)
    vaultContractURI = await vault.contractURI() 
    logger.pad(30, 'New contract URI for vault contract:', vaultContractURI)
  }
  else {
    logger.out('URI already set correctly')
  }
  logger.divider()


  // Change Vault token URI
  logger.out('Checking Vault token URI...')
  let newVaultTokenURI = `https://api.coinlander.${env}/meta/vault/{id}`
  let vaultTokenURI = await vault.uri(1) 
  logger.pad(30, 'Current URI for vault contract:', vaultTokenURI)
  if(vaultTokenURI != newVaultTokenURI) {
    await vault.changeURI(newVaultTokenURI)
    vaultTokenURI = await vault.uri(1) 
    logger.pad(30, 'New token URI for vault contract:', vaultTokenURI)
  }
  else {
    logger.out('URI already set correctly')
  }
  logger.divider()

  if(network.chainId == 42161) {

    // Get addresses
    logger.out('Setting ownership patterns')
    const [deployer, ...accounts] = await ethers.getSigners()
    
    //@todo uncomment below for prod
    // let multiSig = envConfig.MultiSigAddr
    let multiSig = accounts[0].address

    logger.out('Permissions for deployer will be revoked and granted to multisig')
    logger.pad(30,'Deployer: ',deployer.address)
    logger.pad(30,'Multisig: ', multiSig)
    logger.divider()

    // Set ownership patterns

    // SeasonOne 
    await seasonOne.transferOwnership(multiSig)
    logger.out('Season One ownership transfer successful')

    // Seekers
    let KEEPERS_ROLE = ethers.utils.keccak256(
      ethers.utils.formatBytes32String("KEEPERS_ROLE")
    )
    let DEFAULT_ADMIN_ROLE = await seekers.DEFAULT_ADMIN_ROLE()
    // set multisig as admin and Keeper
    await seekers.addKeeper(multiSig)
    await seekers.grantRole(DEFAULT_ADMIN_ROLE, multiSig)
    // have deployer remove permissions from self 
    await seekers.renounceRole(KEEPERS_ROLE, deployer.address)
    await seekers.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address)
    logger.out('Seekers admin transfer successful')

    // Vault
    await vault.transferOwnership(multiSig)
    logger.out('Vault ownership transfer successful')
    logger.divider()
  }
}

postDeployAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
