import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { SeasonOne__factory, SeasonOne } from "../typechain"
import { Seekers__factory, Seekers } from "../typechain"
import { Vault__factory, Vault } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"
import * as fs from "fs";
import * as logger from '../scripts/logger'



describe("SeasonOne", function () {
  let owner: SignerWithAddress
  let userA: SignerWithAddress
  let userB: SignerWithAddress
  let accounts: SignerWithAddress[]
  let SeasonOne: SeasonOne__factory
  let seasonOne: SeasonOne
  let Seekers: Seekers__factory
  let seekers: Seekers
  let Vault: Vault__factory
  let vault: Vault
  let winner:  SignerWithAddress
  let notWinner: SignerWithAddress
  let seekerOfWinner: BigNumber

  before(async function () {
    [owner, userA, userB, ...accounts] = await ethers.getSigners()
    SeasonOne = await ethers.getContractFactory("SeasonOne") as SeasonOne__factory
    Seekers = await ethers.getContractFactory("Seekers") as Seekers__factory
    Vault = await ethers.getContractFactory("Vault") as Vault__factory

    // Get Contract addresses from emulation 
    const index: string = '2'
    const addressesJson = fs.readFileSync('addresses.json', 'utf8')
    const deployData = JSON.parse(addressesJson)
    const addresses = deployData[index]
    
    // Attach
    seekers = await Seekers.attach(addresses.contracts.seekers)
    vault = await Vault.attach(addresses.contracts.vault)
    seasonOne = await SeasonOne.attach(addresses.contracts.seasonOne)
    logger.pad(30, 'Seekers contract:', seekers.address)
    logger.pad(30, 'Vault contract:', vault.address)
    logger.pad(30, 'SeasonOne contract:', seasonOne.address)
    logger.divider()

    let released = await seasonOne.released()
    if (!released) {
      console.log('Contracts have not reached sweet release')
      return process.exit(1)
    }

    let winnerAddress = await seasonOne.COINLANDER()
    if (winnerAddress == userA.address) {
      winner = userA
      notWinner = userB
    } 
    else {
      winner = userB
      notWinner = userA
    }
  
  })

  describe("winner handling", () => {
    it("gives the winner the winner seeker", async ()=> {
      expect(await seekers.ownerOf(1)).to.equal(winner.address)
    })
  })

  describe("the One Coin has become unlocked", () => {
    it("does not move the Coin after the release", async ()=> {
      expect(await (await seasonOne.balanceOf(winner.address, 0)).toNumber()).to.equal(1)
    })
    
    it("allows the winner to send the one coin", async ()=> {
      await seasonOne.connect(winner).safeTransferFrom(winner.address, notWinner.address, 0, 1, "0x00")
      expect(await (await seasonOne.balanceOf(winner.address, 0)).toNumber()).to.equal(0)
      expect(await (await seasonOne.balanceOf(notWinner.address, 0)).toNumber()).to.equal(1)
    })

    it("disables seizing", async ()=> {
      await expect(seasonOne.connect(notWinner).seize( {value: 1})).to.be.revertedWith("E001")
    })
  })

  describe("the vault is setup", () => {

    it("the prize pool in the Vault contract is non-zero", async ()=> {
      expect(await vault.prize()).to.be.greaterThan(0)
    })
  })

  describe("the airdrop is unlocked and distributed successfully", ()=> {

    before(async function () {
      seekerOfWinner = await seekers.tokenOfOwnerByIndex(winner.address, 1)
    })

    it("does not allow a user that does not own a seeker to claim its airdrop", async () => {
      await expect(seasonOne.connect(notWinner).airdropClaimBySeekerId(seekerOfWinner)).to.be.revertedWith("E011")
    })
    
    it("allows a seeker owner to claim its airdrop", async ()=> {
      let beforeShardBal = await (await seasonOne.balanceOf(winner.address, 1)).toNumber()
      console.log("Before shard bal: ", beforeShardBal)
      await seasonOne.connect(winner).airdropClaimBySeekerId(seekerOfWinner)
      let afterShardBal = await (await seasonOne.balanceOf(winner.address, 1)).toNumber()
      console.log("After shard bal: ", afterShardBal)
      expect(afterShardBal).to.be.greaterThan(beforeShardBal)
    })

    it("does not allow a Seekers drop to be claimed more than once", async () => {
      await expect(seasonOne.connect(winner).airdropClaimBySeekerId(seekerOfWinner)).to.be.revertedWith("E012")
    })

  })

})