import {ethers} from "hardhat"
import {HardhatEthersHelpers} from "hardhat/types"
import * as fs from "fs";
import * as logger from "./logger"

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

  // Check if each event triggered successfully
  console.log("Seizure number: ", await (await seasonOne.seizureCount()).toNumber())
  console.log("Prize: ", await (await seasonOne.prize()).div(1E12).toNumber())

  let uncloaking = await seekers.uncloaking()
  console.log("Uncloaking: ", uncloaking) 
  
  let shardSpendable = await seasonOne.shardSpendable()
  console.log("Shard spendable: ", shardSpendable)

  let firstMint = await seekers.firstMintActive()
  console.log("First mint active: ", firstMint)

  let secondMint = await seekers.secondMintActive()
  console.log("Second mint active: ", secondMint)

  let thirdMint = await seekers.thirdMintActive()
  console.log("Third mint active: ", thirdMint)

  let released = await seasonOne.released()
  console.log("Sweet release status: ", released)

  if(released) {
    let ownerOfWinnerSeeker = await seekers.ownerOf(1)
    console.log("Owner of winner seeker: ", ownerOfWinnerSeeker)

    let winner = await seasonOne.COINLANDER()
    console.log("COINLANDER: ", winner)
  }

  // Check inventory of each user
  for(const user of accounts) {
    logger.divider()
    console.log('USER: ', user.address)
    console.log('SHARD: ', await (await seasonOne.balanceOf(user.address, 1)).toNumber())
    let numSeekers = await (await seekers.balanceOf(user.address)).toNumber()
    console.log('Seekers: ', numSeekers)
    // let seekerIds = []
    // for (var i = 0; i < numSeekers; i++){
    //   var id = await (await seekers.tokenOfOwnerByIndex(user.address, i)).toNumber()
    //   seekerIds.push(id)
    // }
    // console.log('Seeker Ids: ', seekerIds)
    for (var i = 1; i <= 8; i++){
      var qty = await (await vault.balanceOf(user.address, i)).toNumber()
      console.log('Fragment%d: ', i, qty)
    }
  } 
  
  // list deposits
  logger.divider()
    try {
      let i = 0
      while (true) { 
        let deposit = await seasonOne.cloinDeposits(i)
        console.log("Deposit %d: ", i)
        console.log(deposit.depositor)
        console.log(deposit.amount)
        console.log(deposit.blockNumber)
        logger.divider()
        i++
      }
    }
    catch (error) {
    }
   
  let vaultBal = await vault.prize()
  console.log("Vault balance is: ", vaultBal.toNumber())
}

checkState()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
