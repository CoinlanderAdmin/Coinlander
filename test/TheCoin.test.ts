import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { CoinOne__factory, CoinOne } from "../typechain"
import { Immortals__factory, Immortals } from "../typechain"
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
  let Immortals: Immortals__factory
  let immortals: Immortals


  before(async function () {
    ;[owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
    CoinOne = (await ethers.getContractFactory(
      "CoinOne",
      owner
    )) as CoinOne__factory

    Immortals = (await ethers.getContractFactory(
      "Immortals",
      owner
    )) as Immortals__factory
  })

  beforeEach(async function () {
    immortals = await Immortals.deploy()
    coinOne = await CoinOne.deploy(immortals.address)
    await immortals.transferOwnership(coinOne.address)
  })

  it("can be deployed", async function () {
    const coinOne = await CoinOne.deploy(immortals.address)
    await coinOne.deployed()
  })

  describe("constructor", () => {
    it("sets the creator as the holder", async () => {
      expect(owner.address).to.equal(await coinOne.COINLANDER())
    })

    it("creates a single token ", async () => {
      expect(await coinOne.totalSupply()).to.equal(1)
    })

    it("assigns the token to the creator", async () => {
      expect(await coinOne.balanceOf(owner.address)).to.equal(1)
    })
  })

  describe("before stealing", () => {
    let SS: BigNumber
    beforeEach(async function () {
      SS = await coinOne.seizureStake()
      await coinOne.connect(userA).steal({ value: SS })
    })

    it("does not allow the owner to steal", async () => {
      SS = await coinOne.seizureStake()
      await expect(coinOne.connect(userA).steal({ value: SS })).to.be.revertedWith(
        "You can't steal from yourself!")
    })

    it("requires the value is exactly the SS", async () => {
      SS = await coinOne.seizureStake()
      await expect(coinOne.connect(userB).steal({ value: SS.sub(1) })).to.be.revertedWith(
        "Must claim with exactly seizure stake")
    })
  })
  
  describe("once holding", () => {
    let SS: BigNumber
    beforeEach(async function () {
      SS = await coinOne.seizureStake()
      await coinOne.connect(userA).steal({ value: SS })
    })

    it("does not let the holder send the One Coin", async () => {
      await expect(coinOne.connect(userA).transfer(userB.address, 1)).to.be.revertedWith(
        "The one coin cannot be transferred except by stealing until it is released.")
    })

    it("sets the deposit according to the seizure price less platform take", async () => {
      let reserveA = await coinOne.reserve()
      await expect((await coinOne.deposit())).to.equal(SS.sub(reserveA))
      SS = await coinOne.seizureStake()
      await coinOne.connect(userB).steal({ value: SS })
      let reserveB = (await coinOne.reserve()).sub(reserveA)
      await expect((await coinOne.deposit())).to.equal(SS.sub(reserveB))
    })
  })

  describe("after stealing", () => {
    let SS: BigNumber
    beforeEach(async function () {
      SS = await coinOne.seizureStake()
      await coinOne.connect(userA).steal({ value: SS })
    })

    it("CoinOne belongs to the stealer", async () => {
      expect(
        await (await coinOne.balanceOf(userA.address)).toNumber()
      ).to.equal(1)
      expect(await coinOne.COINLANDER()).to.equal(userA.address)
    })

    it("the SS has increased", async () => {
      const mss = await coinOne.seizureStake()
      expect(mss.gt(SS)).to.be.true
    })
  })

  describe("upon withdrawDeposit", () => {
    let SS: BigNumber
    beforeEach(async function () {
      SS = await coinOne.seizureStake()
      await coinOne.connect(userA).steal({ value: SS })
      SS = await coinOne.seizureStake()
      await coinOne.connect(userB).steal({ value: SS })
    })

    it("reverts if there isn't anything to withdraw", async () => {
      await expect(coinOne.connect(userB).withdrawDeposit()).to.be.revertedWith(
        "Nothing to withdraw")
    })

    it("pays the user their deposit", async () => {
      let beforeBalance = await userA.getBalance()
      await coinOne.connect(userA).withdrawDeposit()
      let afterBalance = await userA.getBalance()
      expect(afterBalance.gt(beforeBalance)).to.be.true
    })

    it("mints an Immortal for them", async () => {
      await coinOne.connect(userA).withdrawDeposit()
      expect(await (await immortals.balanceOf(userA.address)).toNumber()
      ).to.equal(1)
    })

    it("does not let them withdraw again", async ()=> {
      await coinOne.connect(userA).withdrawDeposit()
      await expect(coinOne.connect(userB).withdrawDeposit()).to.be.revertedWith(
        "Nothing to withdraw")
    })
  })

  
})