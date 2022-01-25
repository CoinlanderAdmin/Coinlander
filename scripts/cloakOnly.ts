import {ethers} from "hardhat"
import * as fs from "fs";
import * as logger from "./logger"

export async function deploy() {
  logger.divider()
  logger.out('Deploying Seeker contract', logger.Level.Info)
  logger.divider()

  const [deployer] = await ethers.getSigners()

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
  await seekers.summonSeeker(8,{value : p.mul(8)})
  
  // Generate art for ids 2-8
  for (let i = 1; i < 8; i++) {
    var id = await seekers.tokenOfOwnerByIndex(deployer.address, i)
    logger.out('Uncloaking seeker: ' + id.toNumber())
    await seekers.connect(deployer).uncloakSeeker(id)
    console.log('Alignment: ' + (await seekers.getAlignmentById(id)))
    let fullCloak = await seekers.getFullCloak(id)
    var json = JSON.stringify(fullCloak);
    var fs = require('fs');
    fs.writeFileSync('local/data/' + id.toNumber() + '.json', json, 'utf8');
    logger.divider()
  }

  // Regen art for id 2
  await seekers.addScales(2, 10);
  let scaleCount = await (await seekers.getScaleCountById(2)).toNumber()
  for (let i = 1; i < scaleCount; i++) {
    await seekers.rerollDethscales(2,1)
    let fullCloak = await seekers.getFullCloak(2)
    var json = JSON.stringify(fullCloak);
    var fs = require('fs');
    fs.writeFileSync('local/data/' + 2 + '_regen_' + i + '.json', json, 'utf8');

    console.log('Regenerating Seeker id 2')
    logger.divider()

  }

}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
