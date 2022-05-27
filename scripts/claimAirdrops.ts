import {ethers} from "hardhat"
import {HardhatEthersHelpers} from "hardhat/types"
import * as fs from "fs";
import * as logger from "../utils/logger"

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
  const SeasonOne = await ethers.getContractFactory("SeasonOne")
  const seasonOne = await SeasonOne.attach(addresses.contracts.seasonOne)
  logger.pad(30, 'Seekers contract:', seekers.address)
  logger.pad(30, 'SeasonOne contract:', seasonOne.address)
  logger.divider()

  
  const [owner, userA, userB] = await ethers.getSigners()

  // Check inventory of each user
  logger.divider()
  console.log('USER: ', userA.address)
  let numSeekers = await (await seekers.balanceOf(userA.address)).toNumber()
  console.log('Seekers Count: ', numSeekers)
  let seekerIds = []
  for (var i = 0; i < numSeekers; i++){
    let beforeShardBal = await (await seasonOne.balanceOf(userA.address, 1)).toNumber()
    var id = await (await seekers.tokenOfOwnerByIndex(userA.address, i)).toNumber()
    seekerIds.push(id)
    let claimed = await seasonOne.claimedAirdropBySeekerId(id)
    if(!claimed) {
      await seasonOne.connect(userA).airdropClaimBySeekerId(id)
      let afterShardBal = await (await seasonOne.balanceOf(userA.address, 1)).toNumber()
      console.log("Airdrop for seeker id %d :", id, afterShardBal - beforeShardBal)
    }
    else {
      console.log("Airdrop already claimed for id %d", id)
    }
  }
  //console.log('Seeker Ids: ', seekerIds)
}

checkState()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
