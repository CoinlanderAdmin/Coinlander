import {ethers} from "hardhat"
import {HardhatEthersHelpers} from "hardhat/types"
import * as fs from "fs";
import * as logger from "./logger"

export async function checkState() {
  logger.divider()
  logger.out('Attaching to contracts to check state', logger.Level.Info)
  logger.divider()

  const index: string = '2'
  const filename: string = 'E7-meta'

  // We must use the injected hardhat param instead of directly importing because we run this
  // as a hardhat task. https://hardhat.org/advanced/hardhat-runtime-environment.html
  
  // Load json config data. We want to use fs here instead of imports because
  // this data shouldn't be stored in git, and causes bad imports pre-deploy script
  const addressesJson = fs.readFileSync('local/addresses.json', 'utf8');
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

    await seasonOne.connect(accounts[0]).claimAll( { gasLimit: 10000000})
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
