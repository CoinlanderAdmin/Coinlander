import {ethers} from "hardhat"
import * as fs from "fs";
import * as logger from "./logger"
import simpleGit, { SimpleGit, CleanOptions } from 'simple-git';
import { hrtime } from "process";


export async function deploy() {
  let data: any = {}
  const git: SimpleGit = simpleGit().clean(CleanOptions.FORCE);

  const network = await ethers.provider.getNetwork()

  logger.divider()
  logger.out("Deploying to: " + network.name, logger.Level.Info)
  if(network.chainId == 31337) {
    logger.divider()
    logger.out("Committing and tagging as release...", logger.Level.Info)
    git.add('.')
    git.commit('Autonomous commit for deploy at ' + getFullTimestamp() + 'on ' + network.name)
    let newTag = await nextTag(git)
    git.tag([newTag])
    git.pushTags()
  }
  
  for(let i = 0; i < 3; i ++){
    logger.divider()
    logger.out('Starting contract deploy...', logger.Level.Info)
    logger.divider()

    const [deployer] = await ethers.getSigners()
    const deployBlock = await (await ethers.provider.getBlock("latest")).number

    // Deploy the NFT contract
    const Seekers = await ethers.getContractFactory("Seekers")
    const seekers = await Seekers.deploy()
    await seekers.deployed()
    logger.pad(30, 'Seekers contract:', seekers.address)

    // Deploy the Keepers Vault contract 
    const Vault = await ethers.getContractFactory("Vault")
    const vault = await Vault.deploy(seekers.address)
    await vault.deployed()
    logger.pad(30, 'Vault contract:', vault.address)

    // Deploy the Coin contract 
    const SeasonOne = await ethers.getContractFactory("SeasonOne")
    const seasonOne = await SeasonOne.deploy(seekers.address, vault.address)
    await seasonOne.deployed()
    logger.pad(30, 'SeasonOne contract:', seasonOne.address)

    // Establish permissions for SeasonOne contract within Seekers contract
    await seekers.addGameContract(seasonOne.address)

    // Set SeasonOne contract as owner of vault contract
    await vault.transferOwnership(seasonOne.address)

    data[i] = {
      "deployBlock": deployBlock,
      contracts: {
        "seekers": seekers.address,
        "vault": vault.address,
        "seasonOne": seasonOne.address
      }
    }

  }


  // const network = await ethers.getDefaultProvider().getNetwork();
  // console.log(network.name)
  // if (network.name == "") {
  //   console.log('ye')


  // }

  logger.divider()
  logger.out('Exporting contract address data...')
  logger.divider()

  // Build local json file. Used to store address contract data
  
  const json = JSON.stringify(data, null, 2)
  fs.writeFileSync('local/addresses.json', json, "utf8")

  logger.out('Deploy complete!', logger.Level.Info)
  logger.divider()
}

async function nextTag(git: SimpleGit) {
  let latestTag = (await git.tags()).latest
  if(latestTag) {
    let latestSplit = latestTag.split(".")
    let majorIncr: number = +latestSplit[1] + 1
    latestSplit[1] = majorIncr.toString()
    return latestSplit.join('.')
  }
  return ""
}

function getFullTimestamp () {
  const pad = (n: any,s=2) => (`${new Array(s).fill(0)}${n}`).slice(-s);
  const d = new Date();
  
  return `${pad(d.getFullYear(),4)}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}


deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
