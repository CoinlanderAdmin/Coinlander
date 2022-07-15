import {ethers} from "hardhat"
import {HardhatEthersHelpers} from "hardhat/types"
import * as fs from "fs";
import * as logger from "../utils/logger"

export async function checkState() {
  logger.divider()
  logger.out('Attaching to contracts to check state', logger.Level.Info)
  logger.divider()

  const index: string = '1'
  const addressesJson = fs.readFileSync('addresses.json', 'utf8');
  const deployData = JSON.parse(addressesJson);
  const addresses = deployData[index]


  // Attach to deployed contracts
  const Vault = await ethers.getContractFactory("Vault")
  const vault = await Vault.attach(addresses.contracts.vault)
  logger.pad(30, 'Vault contract:', vault.address)
  logger.divider()

  
  const [owner, ...accounts] = await ethers.getSigners()

  // Check if each event triggered successfully
  let requestId = 2
  await vault.fulfillRequest(requestId)
}

checkState()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
