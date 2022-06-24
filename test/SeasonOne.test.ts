import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { SeasonOne__factory, SeasonOne } from "../typechain"
import { Seekers__factory, Seekers } from "../typechain"
import { Vault__factory, Vault } from "../typechain"
import { Cloak__factory, Cloak } from "../typechain"
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
  let CloakLib: Cloak__factory
  let cloak: Cloak
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
    CloakLib = (await ethers.getContractFactory(
      "Cloak",
      owner
    )) as Cloak__factory
    
    cloak = await CloakLib.deploy() 
  })

  beforeEach(async function () {
    seekers = await Seekers.deploy(cloak.address)
    vault = await Vault.deploy()
    seasonOne = await SeasonOne.deploy(seekers.address, vault.address)
    await seekers.addGameContract(seasonOne.address)
    await seasonOne.startGame()
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


  describe("during contractURI change", () => {
    it("lets the owner change the contract URI", async () => {
      let currentURI = await seasonOne.contractURI()
      console.log(currentURI)
      await seasonOne.setContractURI("testuri")
      let newURI = await seasonOne.contractURI()
      console.log(newURI)
    })
  })

  describe("before stealing", () => {
    beforeEach(async function () {
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userA).seize({ value: SS })
    })

    it("does not allow the owner to steal", async () => {
      SS = await seasonOne.seizureStake()
      await expect(seasonOne.connect(userA).seize({ value: SS })).to.be.revertedWith("E-000-003")
    })

    it("requires the value is exactly the SS", async () => {
      SS = await seasonOne.seizureStake()
      await expect(seasonOne.connect(userB).seize({ value: SS.sub(1) })).to.be.revertedWith("E-000-002")
    })
  })
  
  describe("once holding the One Coin", () => {
    
    beforeEach(async function () {
      SS = await seasonOne.seizureStake()
      await seasonOne.connect(userA).seize({ value: SS })
    })

    it("does not let the holder send the One Coin", async () => {
      await expect(seasonOne.connect(userA).safeTransferFrom(userA.address,userB.address, 0, 1, "0x00")).to.be.revertedWith("E-000-004")
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
      let takeRate = await seasonOne.PERCENTPRIZE()
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
      await expect(seasonOne.connect(userB).claimAll()).to.be.revertedWith("E-000-010")
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
      await expect(seasonOne.connect(userA).claimAll()).to.be.revertedWith("E-000-010")
    })
  })
  
  describe("keeperShardMint", () => {
    let keeperShardQty: number = 111

    it("allows the keepers to mint their shard", async ()=> {
      await seasonOne.keeperShardMint(keeperShardQty)
    })

    it("allows the keepers to mint their shard in multiple batches", async ()=> {
      await seasonOne.keeperShardMint(keeperShardQty-1)
      await seasonOne.keeperShardMint(1)
    })

    it("reverts if they try to mint too many", async ()=> {
      await expect(seasonOne.keeperShardMint((keeperShardQty+1))).to.be.reverted
    })

    it("does not allow a non-owner to call it", async () => {
      await expect(seasonOne.connect(userA).keeperShardMint(1)).to.be.reverted
    })
  })
})