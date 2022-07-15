import {ethers} from "hardhat"
import {HardhatEthersHelpers} from "hardhat/types"
import * as fs from "fs";
import * as logger from "../utils/logger"
import { envConfig } from "../utils/env.config"

function dec2bin(dec: number) {
  return (dec >>> 0).toString(2);
}

export async function checkState() {
  logger.divider()
  logger.out('Attaching to contracts to check state', logger.Level.Info)
  logger.divider()

  const index: string = '0'
  const addressesJson = fs.readFileSync('addresses.json', 'utf8');
  const deployData = JSON.parse(addressesJson);
  const addresses = deployData[index]
  const multisig = envConfig.MultiSigAddr


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

  // Check balance of multisig
  let shardBal = await seasonOne.balanceOf(multisig,1)
  logger.pad(30, 'Multisig Shard balance: ', shardBal.toNumber())

  // Get seizure status
  let COINLANDER = await seasonOne.COINLANDER()
  logger.pad(30, 'Current Coinlander: ', COINLANDER)
  let seizureCount = await seasonOne.seizureCount()
  logger.pad(30, 'Seizure count: ', seizureCount.toNumber())

}

checkState()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
