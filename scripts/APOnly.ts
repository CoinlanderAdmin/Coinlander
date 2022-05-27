import {ethers} from "hardhat"
import * as fs from "fs";
import * as logger from "../utils/logger"
import { hrtime } from "process";

export async function deploy() {
  logger.divider()
  logger.out('Deploying Seeker contract', logger.Level.Info)
  logger.divider()

  const [deployer, userA, ...accounts] = await ethers.getSigners()
  // Deploy the NFT contract
  const Seekers = await ethers.getContractFactory("Seekers")
  const seekers = await Seekers.deploy()
  await seekers.deployed()
  logger.pad(30, 'Seekers contract:', seekers.address)

  // Establish permissions for SeasonOne contract within Seekers contract
  await seekers.addGameContract(deployer.address)

  logger.divider()
  logger.out('Summoning seekers and uncloaking')
  logger.divider()

  await seekers.activateFirstMint()
  await seekers.performUncloaking()
  let p = await seekers.currentPrice()
  for (let i = 0; i < 100; i++) {
    await seekers.connect(userA).summonSeeker(10,{value : p.mul(10)})
  }
  
  let numTokens = (await seekers.balanceOf(userA.address)).toNumber()
  let allData: any = {}
  // Generate art for ids 2-8
  for (let i = 0; i < numTokens; i++) {
    var id = await seekers.tokenOfOwnerByIndex(userA.address, i)
    logger.out('Uncloaking seeker: ' + id.toNumber())
    await seekers.connect(userA).uncloakSeeker(id)
    let alignment = await seekers.getAlignmentById(id)
    console.log('Alignment: ' + alignment)
    let APs = await seekers.getApById(id)
    console.log('APs: ', APs)
    let singleData = {
      'aps' : APs,
      'alignment' : alignment
    }
    let idx = id.toNumber()
    allData[idx] = singleData
    await ethers.provider.send("evm_mine",[])
  }
  var json = JSON.stringify(allData);
  var fs = require('fs');
  fs.writeFileSync('local/data/attributes.json', json, 'utf8');
  logger.divider()
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })