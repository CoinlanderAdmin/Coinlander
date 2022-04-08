import {ethers} from "hardhat"
import {HardhatEthersHelpers} from "hardhat/types"
import * as fs from "fs";
import * as logger from "../utils/logger"

export async function testAuction() {
  logger.divider()
  logger.out('Attaching to contracts to check state', logger.Level.Info)
  logger.divider()

  const addressesJson = fs.readFileSync('local/addresses.json', 'utf8');
  const addresses = JSON.parse(addressesJson);


  // Attach to deployed contracts
  const Seekers = await ethers.getContractFactory("Seekers");
  const seekers = await Seekers.attach(addresses.contracts.seekers);
  const Auction = await ethers.getContractFactory("ERC721Marketplace")
  const auction = await Auction.attach(addresses.contracts.nftMarketplace)
  logger.pad(30, 'Seekers contract:', seekers.address)
  logger.pad(30, 'NFT Auction contract:', auction.address)
  logger.divider()

  
  const [owner, userA, userB, ... accounts] = await ethers.getSigners()

  // Setup contracts for go time
  await seekers.addGameContract(owner.address)
  await seekers.activateFirstMint()
  
  let v = await seekers.currentPrice()
  // mint 3 seekers for user 0
  let mintNum = 3
  await seekers.connect(userA).summonSeeker(mintNum, { value: v.mul(mintNum)})
  
  let tokenIDs = []
  for(let i = 0; i < mintNum; i++) {
    let id = await seekers.tokenOfOwnerByIndex(userA.address, i)
    tokenIDs.push(id)
  }

  // List a token for auction
  let minPrice = 100
  let buyPrice = 1000
  let auctionBidPeriod = 86400 // 1 day
  let bidIncreasePer = 100 // 1% each time a new bid lands

  // List tokens 
  console.log('User A listing token: ', tokenIDs[0].toNumber())
  await auction.connect(userA).createNewNftAuction(
    seekers.address,
    tokenIDs[0],
    minPrice,
    buyPrice,
    auctionBidPeriod,
    bidIncreasePer)

  console.log('User A listing token: ', tokenIDs[1].toNumber())
  await auction.connect(userA).createNewNftAuction(
    seekers.address,
    tokenIDs[1],
    minPrice,
    buyPrice,
    auctionBidPeriod,
    bidIncreasePer)

  console.log('User A listing token: ', tokenIDs[2].toNumber())
  await auction.connect(userA).createNewNftAuction(
    seekers.address,
    tokenIDs[2],
    minPrice,
    buyPrice,
    auctionBidPeriod,
    bidIncreasePer)

  // Have User B bid on the tokens 
  console.log('User B bidding on token: ', tokenIDs[0].toNumber())
  console.log('Bidding with min bid: ', minPrice)
  await auction.connect(userB).makeBid(seekers.address,tokenIDs[0], {value: minPrice })

  console.log('User B bidding on token: ', tokenIDs[1].toNumber())
  console.log('Bidding with buy now price: ', buyPrice)
  await auction.connect(userB).makeBid(seekers.address,tokenIDs[1], {value: buyPrice })

  console.log('User B bidding on token: ', tokenIDs[2].toNumber())
  console.log('Bidding with less than min bid: ', minPrice-1)
  await auction.connect(userB).makeBid(seekers.address,tokenIDs[2], {value: minPrice-1 })
}

testAuction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
