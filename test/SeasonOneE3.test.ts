import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { SeasonOne__factory, SeasonOne } from "../typechain"
import { Seekers__factory, Seekers } from "../typechain"
import { Vault__factory, Vault } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"
import * as fs from "fs";
import { timeStamp } from "console"


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
  let SS: BigNumber
  let oldSS: BigNumber

  before(async function () {
    [owner, userA, userB, ...accounts] = await ethers.getSigners()
    SeasonOne = await ethers.getContractFactory("SeasonOne") as SeasonOne__factory
    Seekers = await ethers.getContractFactory("Seekers") as Seekers__factory
    Vault = await ethers.getContractFactory("Vault") as Vault__factory

    // Get Contract addresses from emulation 
    const index: string = '1'
    const addressesJson = fs.readFileSync('addresses.json', 'utf8')
    const deployData = JSON.parse(addressesJson)
    const addresses = deployData[index]
    
    // Attach
    seekers = await Seekers.attach(addresses.contracts.seekers)
    vault = await Vault.attach(addresses.contracts.vault)
    seasonOne = await SeasonOne.attach(addresses.contracts.seasonOne)

  })

  describe("upon burnShardForScale", () => {

    it("requires that the user holds a shard", async ()=> {
      await expect(seasonOne.burnShardForScale(1,1)).to.be.revertedWith("E007")
    })

    it("requires that the user specifies a non-zero shard amount", async ()=> {
      await expect(seasonOne.connect(userA).burnShardForScale(1,0)).to.be.revertedWith("E006")
    })

    it("requires that the user specifies a valid seeker id", async ()=> {
      await expect(seasonOne.connect(userA).burnShardForScale(0,1)).to.be.reverted
    })

    it("requires that the user holds the amount of shard they're trying to burn", async ()=> {
      await expect(seasonOne.connect(userA).burnShardForScale(1,1000000)).to.be.revertedWith("E007")
    })

    it("successfully burns shard", async ()=> {
      let id = await seekers.tokenOfOwnerByIndex(userA.address,1)
      let shardBalBefore = await seasonOne.balanceOf(userA.address, 1)
      let scalesBefore = await seekers.getScaleCountById(id)
      await seasonOne.connect(userA).burnShardForScale(id,1)
      let shardBalAfter = await seasonOne.balanceOf(userA.address, 1)
      let scalesAfter = await seekers.getScaleCountById(id)
      expect(shardBalBefore).to.be.equal(shardBalAfter.add(1))
      expect(scalesAfter).to.be.greaterThan(scalesBefore)
    })
  })

  describe("upon stakeShardForCloin", () => {

    it("requires that the user holds a shard", async ()=> {
      await expect(seasonOne.stakeShardForCloin(1)).to.be.revertedWith("E007")
    })

    it("requires that the user specifies a non-zero shard amount", async ()=> {
      await expect(seasonOne.connect(userA).stakeShardForCloin(0)).to.be.revertedWith("E006")
    })

    it("requires that the user holds the amount of shard they're trying to stake", async ()=> {
      await expect(seasonOne.connect(userA).stakeShardForCloin(1000000)).to.be.revertedWith("E007")
    })

    it("successfully burns shard and records the deposit", async ()=> {
      const shardBalBefore = await seasonOne.balanceOf(userA.address, 1)
      let tx = await seasonOne.connect(userA).stakeShardForCloin(1)
      const shardBalAfter = await seasonOne.balanceOf(userA.address, 1)
      let deposit = await seasonOne.cloinDeposits(0)
      console.log(deposit)
      expect(shardBalBefore).to.be.equal(shardBalAfter.add(1))
      expect(deposit.depositor).to.equal(userA.address)
      expect(deposit.amount).to.equal(1)
      expect(deposit.blockNumber).equal(tx.blockNumber)
    })
  })

  describe("upon burn shard for fragment", () => {
    let SHARDTOFRAGMENT: number
    before(async function () {
      SHARDTOFRAGMENT = await (await seasonOne.SHARDTOFRAGMENTMULTIPLIER()).toNumber()
    })

    it("requires the user to specify a non zero shard amount", async () => {
      await expect(seasonOne.connect(userA).burnShardForFragments(0)).to.be.revertedWith("E006")
    })

    it("requires that the user specify an even multiple of the shard-to-fragment conversation rate", async () =>  { 
      await expect(seasonOne.connect(userA).burnShardForFragments(SHARDTOFRAGMENT - 1)).to.be.revertedWith("E008")
    })

    it("allows a user to burn shard for fragment at the correct rate", async () =>  {
      let shardBalBefore = await seasonOne.balanceOf(userA.address, 1)
      await seasonOne.connect(userA).burnShardForFragments(SHARDTOFRAGMENT)
      let shardBalAfter = await seasonOne.balanceOf(userA.address,1) 
      expect(shardBalBefore).to.be.equal(shardBalAfter.add(SHARDTOFRAGMENT))
    })
  })
})