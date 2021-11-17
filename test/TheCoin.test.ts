import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { CoinOne__factory, CoinOne } from "../typechain"
import { Seekers__factory, Seekers } from "../typechain"
import { KeepersVault__factory, KeepersVault } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"

describe("CoinOne", function () {
  let owner: SignerWithAddress
  let userA: SignerWithAddress
  let userB: SignerWithAddress
  let userC: SignerWithAddress
  let accounts: SignerWithAddress[]
  let CoinOne: CoinOne__factory
  let coinOne: CoinOne
  let Seekers: Seekers__factory
  let seekers: Seekers
  let KeepersVault: KeepersVault__factory
  let keepersVault: KeepersVault
  let SS: BigNumber
  let oldSS: BigNumber


  before(async function () {
    ;[owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
    CoinOne = (await ethers.getContractFactory(
      "CoinOne",
      owner
    )) as CoinOne__factory

    Seekers = (await ethers.getContractFactory(
      "Seekers",
      owner
    )) as Seekers__factory

    KeepersVault = (await ethers.getContractFactory(
      "KeepersVault",
      owner
    )) as KeepersVault__factory
  })

  beforeEach(async function () {
    seekers = await Seekers.deploy()
    keepersVault = await KeepersVault.deploy(seekers.address)
    coinOne = await CoinOne.deploy(seekers.address, keepersVault.address)
    await seekers.addGameContract(coinOne.address)
  })

  it("can be deployed", async function () {
    const coinOne = await CoinOne.deploy(seekers.address, keepersVault.address)
    await coinOne.deployed()
  })

  describe("constructor", () => {
    it("sets the creator as the holder", async () => {
      expect(owner.address).to.equal(await coinOne.COINLANDER())
    })

    it("creates a single token and assigns it to deployer", async () => {
      expect(await coinOne.balanceOf(owner.address, 0)).to.equal(1)
    })
  })

  describe("before stealing", () => {
    beforeEach(async function () {
      SS = await coinOne.seizureStake()
      await coinOne.connect(userA).seize({ value: SS })
    })

    it("does not allow the owner to steal", async () => {
      SS = await coinOne.seizureStake()
      await expect(coinOne.connect(userA).seize({ value: SS })).to.be.revertedWith("")
    })

    it("requires the value is exactly the SS", async () => {
      SS = await coinOne.seizureStake()
      await expect(coinOne.connect(userB).seize({ value: SS.sub(1) })).to.be.revertedWith("")
    })
  })
  
  describe("once holding the One Coin", () => {
    
    beforeEach(async function () {
      SS = await coinOne.seizureStake()
      await coinOne.connect(userA).seize({ value: SS })
    })

    it("does not let the holder send the One Coin", async () => {
      await expect(coinOne.connect(userA).safeTransferFrom(userA.address,userB.address, 0, 1, ethers.utils.hexValue(0))).to.be.revertedWith("")
    })

    it("Coinlander belongs to the stealer", async () => {
      expect(
        await (await coinOne.balanceOf(userA.address, 0)).toNumber()
      ).to.equal(1)
    })

    it("stealer is the COINLANDER", async () => {
      expect(await coinOne.COINLANDER()).to.equal(userA.address)
    })
  })
  

  describe("after the coin is seized", () => {
    beforeEach(async function () {
      SS = await coinOne.seizureStake()
      await coinOne.connect(userA).seize({ value: SS })
      oldSS = SS
      SS = await coinOne.seizureStake()
      await coinOne.connect(userB).seize({ value: SS })
    })

    it("sets the withdraw ammt according to the seizure price less platform take", async () => {
      let w = await coinOne.getPendingWithdrawl(userA.address)
      console.log("pending withdrawl:", w)
      let takeRate = await coinOne.PERCENTRESERVES()
      console.log("take rate:", takeRate)
      let take = oldSS.mul(takeRate).div(10000)
      console.log("test calc'd take", take)
      await expect(w).to.equal(oldSS.sub(take))
    })

    it("sets the shard reward according to seizure price", async () => {
      SS = await coinOne.seizureStake()
      await coinOne.connect(userB).seize({ value: SS })
      let s = await coinOne.getPendingShardReward(userA.address)
      expect(s).to.equal(1)
    })

    it("the seizure stake has increased according to the increase rate", async () => {
      let r = (await coinOne.PERCENTRATEINCREASE()).div(10000)
      let i = oldSS.add(oldSS.mul(r)) 
      expect(SS).to.equal(i)
    })
  })

  describe("upon withdrawDeposit", () => {
    beforeEach(async function () {
      SS = await coinOne.seizureStake()
      await coinOne.connect(userA).seize({ value: SS })
      oldSS = SS
      SS = await coinOne.seizureStake()
      await coinOne.connect(userB).seize({ value: SS })
    })

    it("reverts if there isn't anything to withdraw", async () => {
      await expect(coinOne.connect(userB).claimRefundAndShard()).to.be.revertedWith("")
    })

    it("pays the user their deposit", async () => {
      let beforeBalance = await userA.getBalance()
      let refund = await coinOne.getPendingWithdrawl(userA.address)
      await coinOne.connect(userA).claimRefundAndShard()
      let afterBalance = await userA.getBalance()
      expect(afterBalance).to.equal(beforeBalance.sub(refund))
    })

    it ("mints a shard for them", async () => {
      let beforeBalance = await coinOne.balanceOf(userA.address,1)
      expect(beforeBalance).to.equal(0)
      await coinOne.connect(userA).claimRefundAndShard()
      let afterBalance = await coinOne.balanceOf(userA.address,1)
      expect(afterBalance).to.equal(1)
    })

    it("mints a Seeker for them", async () => {
      await coinOne.connect(userA).claimRefundAndShard()
      expect(await (await seekers.balanceOf(userA.address)).toNumber()
      ).to.equal(1)
    })

    it("does not let them withdraw again", async ()=> {
      await coinOne.connect(userA).claimRefundAndShard()
      await expect(coinOne.connect(userA).claimRefundAndShard()).to.be.revertedWith("")
    })
  })
})