import {ethers} from "hardhat"
import {HardhatEthersHelpers} from "hardhat/types"
import * as fs from "fs";
import * as logger from "../utils/logger"
import { BigNumber } from "ethers";

export async function checkState() {
  logger.divider()
  logger.out('Attaching to contracts to check state', logger.Level.Info)
  logger.divider()

  const index: string = '2'
  const addressesJson = fs.readFileSync('addresses.json', 'utf8');
  const deployData = JSON.parse(addressesJson);
  const addresses = deployData[index]


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

  
  const [owner, ...accounts] = await ethers.getSigners()

  // Claim funds / finance

  logger.out('Pulling funds from Seeker Contract...')
  let contractBal: BigNumber = await seekers.provider.getBalance(seekers.address)
  if(!contractBal.isZero()) {
    let ownerBal: BigNumber = await ethers.provider.getBalance(owner.address) 
    logger.pad(30, 'Account current balance:', ethers.utils.formatEther(ownerBal))
    logger.pad(30, 'Claiming contract balance:', ethers.utils.formatEther(contractBal))
    await seekers.ownerWithdraw()
    ownerBal = await owner.getBalance(owner.address) 
    // logger.pad(30, 'Account new balance:', ethers.utils.formatEther(ownerBal))
  }
  else {
    logger.out('Contract has no funds to claim')
  }
  logger.divider()
  
  // Metadata Controls

  // Change Seeker metadata URI 
  logger.out('Checking seeker _baseURI...')
  let newSeekerBaseURI = 'https://api.coinlander.dev/meta/seekers/'
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
  let newSOneBaseURI = 'https://api.coinlander.dev/meta/season-one'
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
  let newSOneTokenURI = 'https://api.coinlander.dev/meta/season-one/{id}'
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
  let newVaultContractURI = 'https://api.coinlander.dev/meta/vault'
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
  let newVaultTokenURI = 'https://api.coinlander.dev/meta/vault/{id}'
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

  // if(!contractBal.isZero()) {
  //   let ownerBal: BigNumber = await owner.getBalance(owner.address) 
  //   logger.pad(30, 'Account current balance:', ownerBal.div(1E18).toString())
  //   logger.pad(30, 'Claiming contract balance:', contractBal.div(1E18).toString())
  //   await seekers.ownerWithdraw()
  //   ownerBal = await owner.getBalance(owner.address) 
  //   logger.pad(30, 'Account new balance:', ownerBal.div(1E18).toString())
  //   logger.divider()
  // }
  // else {
  //   logger.out('Contract has no funds to claim')
  // }
  // logger.out('')
  

  // // Check if each event triggered successfully
  // console.log("Seizure number: ", await (await seasonOne.seizureCount()).toNumber())
  // console.log("Prize: ", await (await seasonOne.prize()).div(1E12).toNumber())

  // let uncloaking = await seekers.uncloaking()
  // console.log("Uncloaking: ", uncloaking) 
  
  // let shardSpendable = await seasonOne.shardSpendable()
  // console.log("Shard spendable: ", shardSpendable)

  // let firstMint = await seekers.firstMintActive()
  // console.log("First mint active: ", firstMint)

  // let secondMint = await seekers.secondMintActive()
  // console.log("Second mint active: ", secondMint)

  // let thirdMint = await seekers.thirdMintActive()
  // console.log("Third mint active: ", thirdMint)

  // let released = await seasonOne.released()
  // console.log("Sweet release status: ", released)

  // if(released) {
  //   let ownerOfWinnerSeeker = await seekers.ownerOf(1)
  //   console.log("Owner of winner seeker: ", ownerOfWinnerSeeker)

  //   let winner = await seasonOne.COINLANDER()
  //   console.log("COINLANDER: ", winner)
  // }

  // // Check inventory of each user
  // for(const user of accounts) {
  //   logger.divider()
  //   console.log('USER: ', user.address)
  //   let withdrawal = await seasonOne.getPendingWithdrawal(user.address)
  //   console.log('Eth available: ', withdrawal[0].div(1E12).toNumber())
  //   console.log('Shard available: ', withdrawal[1].toNumber())
  //   console.log('Seekers available: ', withdrawal[2].toNumber())
  //   console.log('SHARD: ', await (await seasonOne.balanceOf(user.address, 1)).toNumber())
  //   let numSeekers = await (await seekers.balanceOf(user.address)).toNumber()
  //   console.log('Seekers: ', numSeekers)
  //   // //let seekerIds = []
  //   // for (var i = 0; i < numSeekers; i++){
  //   //   var id = await (await seekers.tokenOfOwnerByIndex(user.address, i)).toNumber()
  //   //   console.log(id)
  //   //   //seekerIds.push(id)
  //   // }
  //   //console.log('Seeker Ids: ', seekerIds)
  //   for (var i = 1; i <= 8; i++){
  //     var qty = await (await vault.balanceOf(user.address, i)).toNumber()
  //     console.log('Fragment%d: ', i, qty)
  //   }
  // } 
  // console.log('Claiming for account 0')
  // try { 
  //   await seasonOne.connect(accounts[0]).claimAll()
  // } catch (error) {
  //   console.log(error)
  // }
  
  // console.log('Claiming for account 1')
  // try { 
  //   await seasonOne.connect(accounts[1]).claimAll()
  // } catch (error) {
  //   console.log(error)
  // }
  
  // // list deposits
  // logger.divider()
  //   try {
  //     let i = 0
  //     while (true) { 
  //       let deposit = await seasonOne.cloinDeposits(i)
  //       console.log("Deposit %d: ", i)
  //       console.log(deposit.depositor)
  //       console.log(deposit.amount)
  //       console.log(deposit.blockNumber)
  //       logger.divider()
  //       i++
  //     }
  //   }
  //   catch (error) {
  //   }
   
  // let vaultBal = await vault.prize()
  // console.log("Vault balance is: ", vaultBal.div(1E12).toNumber())
}

checkState()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
