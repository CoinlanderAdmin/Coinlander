import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Immortals__factory, Immortals } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"

describe("Immortals", function () {
  let owner: SignerWithAddress
  let userA: SignerWithAddress
  let userB: SignerWithAddress
  let userC: SignerWithAddress
  let accounts: SignerWithAddress[]
  let Immortals: Immortals__factory
  let immortals: Immortals
  before(async function () {
    ;[owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
    Immortals = (await ethers.getContractFactory(
      "Immortals",
      owner
    )) as Immortals__factory
  })

  beforeEach(async function () {
    immortals = await Immortals.deploy()
  })

  it("can be deployed", async function () {
    const immortals = await Immortals.deploy()
    await immortals.deployed()
  })

  describe("constructor", () => {
    it("sets the name to Immortals", async () => {
      expect(await immortals.name()).to.equal("Immortals")
    })

    it("sets the symbol to IMMOS", async () => {
      expect(await immortals.symbol()).to.equal("IMMOS")
    })
  })
  
  describe("issueImmortal", () => {

    let holdTime = 1
    it("can issue a token for another user", async () => {
      await immortals.issueImmortal(userA.address, holdTime)
      expect(await immortals.balanceOf(userA.address)).to.equal(1)
    })

    it("reverts when arbitrary users try to issue tokens", async () => {
      await expect(immortals.connect(userA).issueImmortal(userA.address, holdTime)).to.be.revertedWith(
        "Ownable: caller is not the owner")
    })

    it("reverts when the token id exceeds the max number", async () => {
      let maxTokens: BigNumber
      maxTokens = await immortals.maxImmortals()
      for(let i = 0; i < maxTokens.toNumber(); i++) {
        await immortals.issueImmortal(userA.address, holdTime)
      }
      expect(await immortals.balanceOf(userA.address)).to.equal(maxTokens.toNumber())
      await expect(immortals.issueImmortal(userA.address, holdTime)).to.be.revertedWith(
        "Maximum number of tokens reached")
    })
  })

  describe("issueSeeker", () => {
    
    it("can issue a token", async () => {
      await immortals.activateFirstMint()
      await immortals.issueSeeker()
      expect(await immortals.balanceOf(owner.address)).to.equal(1)
    })

    it("does not allow someone to mint more than one token", async () => {
      await immortals.activateFirstMint()
      await immortals.connect(userA).issueSeeker()
      await expect(immortals.connect(userA).issueSeeker()).to.be.revertedWith(
        "Only one Seeker can be minted per address")
    })
    
    it("reverts when the token id exceeds the max number", async () => {
      await expect(immortals.issueSeeker()).to.be.revertedWith(
        "Maximum number of tokens mintable reached")
    })
  })

  describe("activateMints", () => {

    it("properly incrememnts the seeker count upon Mint activations", async () => {
      let counter = await immortals.getMaxImmortalCount() // Init to end of immortal id space offset 
      const firstMint = await immortals.firstMint()
      const secondMint = await immortals.secondMint()
      const thirdMint = await immortals.thirdMint()
      await expect(await immortals.currentMaxSeekers() == counter)
      await immortals.activateFirstMint()
      counter = counter.add(firstMint)
      await expect(await immortals.currentMaxSeekers() == counter)
      await immortals.activateSecondMint()
      counter = counter.add(secondMint)
      await expect(await immortals.currentMaxSeekers() == counter)
      await immortals.activateThirdMint()
      counter = counter.add(thirdMint)
      await expect(await immortals.currentMaxSeekers() == counter)
    })

    it("reverts if the first mint has already been activated", async () => {
      await immortals.activateFirstMint()
      await expect(immortals.activateFirstMint()).to.be.revertedWith(
        "Already active")
    })

    it("reverts if the second mint has already been activated", async () => {
      await immortals.activateSecondMint()
      await expect(immortals.activateSecondMint()).to.be.revertedWith(
        "Already active")
    })

    it("reverts if the third mint has already been activated", async () => {
      await immortals.activateThirdMint()
      await expect(immortals.activateThirdMint()).to.be.revertedWith(
        "Already active")
    })
  })

  describe("allImmortalOwners", () => {

    let holdTime = 1
    it("reverts if there is not a token minted yet", async () => {
      await expect(immortals.allImmortalOwners()).to.be.revertedWith(
        "There must be at least one token.")
    })

    it("returns the immortal owner list", async () => {
      let holders = [userA.address, userB.address]
      await immortals.issueImmortal(userA.address, holdTime)
      await immortals.issueImmortal(userB.address, holdTime)
      await immortals.activateFirstMint() 
      await immortals.connect(userC).issueSeeker()
      expect(await immortals.allImmortalOwners()).to.eql(holders)
    })
  })

  describe("allSeekerOwners", () => {

    let holdTime = 1
    it("reverts if there is not a token minted yet", async () => {
      await expect(immortals.allSeekerOwners()).to.be.revertedWith(
        "There must be at least one token.")
    })

    it("returns the seeker owner list", async () => {
      let holders = [userB.address, userC.address]
      await immortals.issueImmortal(userA.address, holdTime)
      await immortals.activateFirstMint() 
      await immortals.connect(userB).issueSeeker()
      await immortals.connect(userC).issueSeeker()
      expect(await immortals.allSeekerOwners()).to.eql(holders)
    })
  })
})
