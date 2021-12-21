import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber, utils } from "ethers"
import { deploy } from "../scripts/deploy"
import * as fs from "fs";
import * as addresses from "../addresses.json" 

// Run thru game
async function main () {

  // Attach to deployed contracts
  const Seekers = await ethers.getContractFactory("Seekers");
  const seekers = await Seekers.attach(addresses.contracts.seekers);

  const Vault = await ethers.getContractFactory("Vault")
  const vault = await Vault.attach(addresses.contracts.vault)

  const SeasonOne = await ethers.getContractFactory("SeasonOne")
  const seasonOne = await SeasonOne.attach(addresses.contracts.seasonOne)

  // Get users
  let owner: SignerWithAddress
  let user: SignerWithAddress
  let previousUser: SignerWithAddress
  let accounts: SignerWithAddress[]
  [owner, ...accounts] = await ethers.getSigners()

  // Set up game params
  let SS: BigNumber
  let SR: number 
  SR = (await seasonOne.SWEETRELEASE()).toNumber()
  let seizureCount = (await seasonOne.seizureCount()).toNumber()

  // Run thru to Sweet Release 
  previousUser = accounts[0]
  let i = 0
  while( seizureCount < SR) {
    SS = await seasonOne.seizureStake()
    
    // Increment thru users  
    
    let index = i % accounts.length 
    console.log("Seizure: ", i)
    user = accounts[index]
    await seasonOne.connect(user).seize({ value: SS })

    if( i != 0 ){
      await seasonOne.connect(previousUser).claimAll()
    }

    seizureCount = (await seasonOne.seizureCount()).toNumber()
    previousUser = user
    i++
  }

  console.log("Released? :", await seasonOne.released())

  // Do post-release validation here 

}

// Then play thru the game 
main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error)
  process.exit(1)
})