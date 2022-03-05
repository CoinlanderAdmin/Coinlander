import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { SeasonOne__factory, SeasonOne } from "../typechain"
import { Seekers__factory, Seekers } from "../typechain"
import { Vault__factory, Vault } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"
import { timeStamp } from "console"


// TODO: migrate the shard tests to a post-emulate validation file 
// A lot of the tests here are broken as a result of the ShardSpendable event.  
// These tests need to be run against a chain that has reached Sweet Release 

describe("SeasonOne", function () {
  let owner: SignerWithAddress
  let userA: SignerWithAddress
  let userB: SignerWithAddress
  let userC: SignerWithAddress
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
    ;[owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
    SeasonOne = (await ethers.getContractFactory(
      "SeasonOne",
      owner
    )) as SeasonOne__factory

    Seekers = (await ethers.getContractFactory(
      "Seekers",
      owner
    )) as Seekers__factory

    Vault = (await ethers.getContractFactory(
      "Vault",
      owner
    )) as Vault__factory   
  })

  beforeEach(async function () {
    seekers = await Seekers.deploy()
    vault = await Vault.deploy(seekers.address)
    seasonOne = await SeasonOne.deploy(seekers.address, vault.address)
    await seekers.addGameContract(seasonOne.address)
  })

  it("can be deployed", async function () {
    const seasonOne = await SeasonOne.deploy(seekers.address, vault.address)
    await seasonOne.deployed()
  })

  describe("during construction", () => {
    it("sets the creator as the holder", async () => {
      expect(owner.address).to.equal(await seasonOne.COINLANDER())
    })

    it("creates a single token and assigns it to deployer", async () => {
      expect(await seasonOne.balanceOf(owner.address, 0)).to.equal(1)
    })
  })

  describe("before stealing", () => {
    beforeEach(async function () {
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userA).seize({ value: SS })
    })

    it("does not allow the owner to steal", async () => {
      SS = await seasonOne.seizureStake()
      await expect(seasonOne.connect(userA).seize({ value: SS })).to.be.reverted
    })

    it("requires the value is exactly the SS", async () => {
      SS = await seasonOne.seizureStake()
      await expect(seasonOne.connect(userB).seize({ value: SS.sub(1) })).to.be.reverted
    })
  })
  
  describe("once holding the One Coin", () => {
    
    beforeEach(async function () {
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userA).seize({ value: SS })
    })

    it("does not let the holder send the One Coin", async () => {
      await expect(seasonOne.connect(userA).safeTransferFrom(userA.address,userB.address, 0, 1, "0x00")).to.be.revertedWith("")
    })

    it("Coinlander belongs to the stealer", async () => {
      await expect((await seasonOne.balanceOf(userA.address, 0)).toNumber()).to.equal(1)
    })

    it("stealer is the COINLANDER", async () => {
      expect(await seasonOne.COINLANDER()).to.equal(userA.address)
    })
  })
  

  describe("after the coin is seized", () => {
    beforeEach(async function () {
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userA).seize({ value: SS })
      oldSS = SS
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userB).seize({ value: SS })
    })

    it("sets the new holder as COINLANDER", async () => {
      await (expect(await seasonOne.COINLANDER()).to.equal(userB.address))
    })

    it("sets the withdraw ammt according to the seizure price less platform take", async () => {
      let w = await seasonOne.getPendingWithdrawal(userA.address)
      let takeRate = await seasonOne.PERCENTTAKE()
      let take = oldSS.mul(takeRate).div(10000)
      await expect(w[0]).to.equal(oldSS.sub(take))
    })

    it("sets the shard reward according to seizure price", async () => {
      let s = await seasonOne.getPendingWithdrawal(userA.address)
      expect(s[1]).to.equal(1)
    })

    it("the seizure stake has increased according to the increase rate", async () => {
      let r = (await seasonOne.PERCENTRATEINCREASE()).mul(oldSS).div(10000)
      let newSS = oldSS.add(r) 
      expect(SS).to.equal(newSS)
    })

    it("sets that a seeker is owed", async () => {
      let s = await seasonOne.getPendingWithdrawal(userA.address)
      expect(s[2]).to.equal(1)
    })
  })

  describe("upon claimAll", () => {
    beforeEach(async function () {
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userA).seize({ value: SS })
      oldSS = SS
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userB).seize({ value: SS })
    })

    it("reverts if there isn't anything to withdraw", async () => {
      await expect(seasonOne.connect(userB).claimAll()).to.be.revertedWith("E010")
    })

    it("pays the user their deposit", async () => {
      let beforeBalance = await userA.getBalance()
      let claimables = await seasonOne.getPendingWithdrawal(userA.address)
      let tx = await seasonOne.connect(userA).claimAll()
      let receipt = await tx.wait()
      let gasFee = receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice)
      let afterBalance = await userA.getBalance()
      expect(claimables[0]).to.be.gt(0)
      expect(afterBalance).to.be.equal(beforeBalance.add(claimables[0]).sub(gasFee))
    })

    it ("mints a shard for them", async () => {
      let beforeBalance = await seasonOne.balanceOf(userA.address,1)
      expect(beforeBalance).to.equal(0)
      await seasonOne.connect(userA).claimAll()
      let afterBalance = await seasonOne.balanceOf(userA.address,1)
      expect(afterBalance).to.equal(1)
    })

    it("mints a Seeker for them", async () => {
      await seasonOne.connect(userA).claimAll()
      expect(await (await seekers.balanceOf(userA.address)).toNumber()
      ).to.equal(1)
    })

    it("does not let them withdraw again", async ()=> {
      await seasonOne.connect(userA).claimAll()
      await expect(seasonOne.connect(userA).claimAll()).to.be.revertedWith("E010")
    })
  })

  describe("upon ownerWithdraw", () => {
    beforeEach(async function () {
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userA).seize({ value: SS })
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userB).seize({ value: SS })
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userA).seize({ value: SS })
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userB).seize({ value: SS })
    })

    it("allows the owner to withdraw the reserve balance", async ()=> {
      let beforeBalance = await owner.getBalance()
      let tx = await seasonOne.ownerWithdraw()
      let receipt = await tx.wait()
      let gasFee = receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice)
      let afterBalance = await owner.getBalance()
      expect(afterBalance).to.be.gt(beforeBalance.sub(gasFee))
    })

    it("does not allow a non-owner to withdraw the reserve balance", async ()=> {
      await expect(seasonOne.connect(userA).ownerWithdraw()).to.be.reverted
    })

    it("does not allow the owner to withdraw more than the reserve", async ()=> {
      await seasonOne.ownerWithdraw()
      await expect(seasonOne.ownerWithdraw()).to.be.reverted
    })
  })

// The following tests have been moved into their respective tests for E3/E7 due to the shard spendable event

  // describe("upon burnShardForPower", () => {
  //   beforeEach(async function () {
  //     SS = await seasonOne.seizureStake()
  //     await seasonOne.connect(userA).seize({ value: SS })
  //     SS = await seasonOne.seizureStake()
  //     await seasonOne.connect(userB).seize({ value: SS })
  //     await seasonOne.connect(userA).claimAll()
  //   })

  //   it("requires that the user holds a shard", async ()=> {
  //     await expect(seasonOne.connect(userB).burnShardForPower(1,1)).to.be.reverted
  //   })

  //   it("requires that the user specifies a non-zero shard amount", async ()=> {
  //     await expect(seasonOne.connect(userA).burnShardForPower(1,0)).to.be.reverted
  //   })

  //   it("requires that the user specifies a valid seeker id", async ()=> {
  //     await expect(seasonOne.connect(userA).burnShardForPower(0,1)).to.be.reverted
  //   })

  //   it("requires that the user holds the amount of shard they're trying to burn", async ()=> {
  //     await expect(seasonOne.connect(userA).burnShardForPower(1,2)).to.be.reverted
  //   })

  //   it("successfully burns shard", async ()=> {
  //     console.log(await seasonOne.balanceOf(userA.address,1))
  //     await seasonOne.connect(userA).burnShardForPower(1,1)
  //     expect(await seasonOne.balanceOf(userA.address,1)).to.equal(0)
  //   })
  // })

  // describe("upon stakeShardForCloin", () => {
  //   beforeEach(async function () {
  //     SS = await seasonOne.seizureStake()
  //     await seasonOne.connect(userA).seize({ value: SS })
  //     SS = await seasonOne.seizureStake()
  //     await seasonOne.connect(userB).seize({ value: SS })
  //     await seasonOne.connect(userA).claimAll()
  //   })

  //   it("requires that the user holds a shard", async ()=> {
  //     await expect(seasonOne.connect(userB).stakeShardForCloin(1)).to.be.reverted
  //   })

  //   it("requires that the user specifies a non-zero shard amount", async ()=> {
  //     await expect(seasonOne.connect(userA).stakeShardForCloin(0)).to.be.reverted
  //   })

  //   it("requires that the user holds the amount of shard they're trying to stake", async ()=> {
  //     await expect(seasonOne.connect(userA).stakeShardForCloin(2)).to.be.reverted
  //   })

  //   it("successfully burns shard", async ()=> {
  //     await seasonOne.connect(userA).stakeShardForCloin(1)
  //     expect(await seasonOne.balanceOf(userA.address,1)).to.equal(0)
  //   })

  //   it("records the deposit successfully", async ()=> {
  //     let tx = await seasonOne.connect(userA).stakeShardForCloin(1)
  //     let deposit = await seasonOne.cloinDeposits(0)
  //     expect(deposit.depositor).to.equal(userA.address)
  //     expect(deposit.amount).to.equal(1)
  //     expect(deposit.blockNumber).equal(tx.blockNumber)
  //   })
  // })

  // describe("upon burn shard for fragment", () => {
  //   let startingBalance = 10
  //   let SHARDTOFRAGMENT: number
  //   beforeEach(async function () {
  //     await seasonOne.keeperShardMint(20)
  //     await seasonOne.safeBatchTransferFrom(owner.address, userA.address, [1], [startingBalance], "0x00")
  //     await seasonOne.safeBatchTransferFrom(owner.address, userB.address, [1], [startingBalance], "0x00")


  //     SS = await seasonOne.seizureStake()
  //     await seasonOne.connect(userA).seize({ value: SS })
  //     SS = await seasonOne.seizureStake()
  //     await seasonOne.connect(userB).seize({ value: SS })
  //     await seasonOne.connect(userA).claimAll()
  //     SHARDTOFRAGMENT = (await seasonOne.SHARDTOFRAGMENTMULTIPLIER()).toNumber()
  //   })

  //   it("requires the user to specify a non zero shard amount", async () => {
  //     await expect(seasonOne.connect(userA).burnShardForFragments(0)).to.be.reverted
  //   })

  //   it("requires that the user specify an even multiple of the shard-to-fragment conversation rate", async () =>  { 
  //     await expect(seasonOne.connect(userA).burnShardForFragments(SHARDTOFRAGMENT - 1)).to.be.reverted
  //   })

  //   it("requires that the user claiming fragments owns a Seeker", async () => {

  //   })
  //   it("allows a user to burn shard for fragment at the correct rate", async () =>  {
  //     await seasonOne.connect(userA).burnShardForFragments(SHARDTOFRAGMENT)
  //     expect(await seasonOne.balanceOf(userA.address, 1)).to.equal(startingBalance - SHARDTOFRAGMENT)
  //   })


//   })
})