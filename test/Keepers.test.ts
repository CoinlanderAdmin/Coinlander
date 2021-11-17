import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Seekers__factory, Seekers } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"

describe("Immortals", function () {
  let owner: SignerWithAddress
  let userA: SignerWithAddress
  let userB: SignerWithAddress
  let userC: SignerWithAddress
  let accounts: SignerWithAddress[]
  let Seekers: Seekers__factory
  let seekers: Seekers
  before(async function () {
    ;[owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
    Seekers = (await ethers.getContractFactory(
      "Seekers",
      owner
    )) as Seekers__factory
  })

  beforeEach(async function () {
    seekers = await Seekers.deploy()
  })

  it("can be deployed", async function () {
    const seekers = await Seekers.deploy()
    await seekers.deployed()
  })

  describe("during construction", () => {
    it("sets the name to Seekers", async () => {
      expect(await seekers.name()).to.equal("Seekers")
    })

    it("sets the symbol to SEEK", async () => {
      expect(await seekers.symbol()).to.equal("SEEK")
    })

    it("sets the deployer to admin", async () => {
      expect(await seekers.hasRole(await (seekers.DEFAULT_ADMIN_ROLE()), owner.address)).to.be.true
    })

    it("creates a Keepers role and assigns it to the deployer", async () => {
      expect(await seekers.hasRole(await (seekers.KEEPERS_ROLE()), owner.address)).to.be.true
    })

    it("mints the winning seeker and gives it to the deployer", async () => {
      expect(await seekers.balanceOf(owner.address)).to.equal(1)
    })
  })
  
  describe("issueImmortal", () => {

    let holdTime = 1
    it("can issue a token for another user", async () => {
      await seekers.issueImmortal(userA.address, holdTime)
      expect(await seekers.balanceOf(userA.address)).to.equal(1)
    })

    it("reverts when arbitrary users try to issue tokens", async () => {
      await expect(seekers.connect(userA).issueImmortal(userA.address, holdTime)).to.be.revertedWith(
        "Ownable: caller is not the owner")
    })

    it("reverts when the token id exceeds the max number", async () => {
      let maxTokens: BigNumber
      maxTokens = await seekers.maxImmortals()
      for(let i = 0; i < maxTokens.toNumber(); i++) {
        await seekers.issueImmortal(userA.address, holdTime)
      }
      expect(await seekers.balanceOf(userA.address)).to.equal(maxTokens.toNumber())
      await expect(seekers.issueImmortal(userA.address, holdTime)).to.be.revertedWith(
        "Maximum number of tokens reached")
    })
  })

  describe("issueSeeker", () => {
    
    it("can issue a token", async () => {
      await seekers.activateFirstMint()
      await seekers.issueSeeker()
      expect(await seekers.balanceOf(owner.address)).to.equal(1)
    })

    it("does not allow someone to mint more than one token", async () => {
      await seekers.activateFirstMint()
      await seekers.connect(userA).issueSeeker()
      await expect(seekers.connect(userA).issueSeeker()).to.be.revertedWith(
        "Only one Seeker can be minted per address")
    })
    
    it("reverts when the token id exceeds the max number", async () => {
      await expect(seekers.issueSeeker()).to.be.revertedWith(
        "Maximum number of tokens mintable reached")
    })
  })

  describe("activateMints", () => {

    it("properly incrememnts the seeker count upon Mint activations", async () => {
      let counter = await seekers.getMaxImmortalCount() // Init to end of immortal id space offset 
      const firstMint = await seekers.firstMint()
      const secondMint = await seekers.secondMint()
      const thirdMint = await seekers.thirdMint()
      await expect(await seekers.currentMaxSeekers() == counter)
      await seekers.activateFirstMint()
      counter = counter.add(firstMint)
      await expect(await seekers.currentMaxSeekers() == counter)
      await seekers.activateSecondMint()
      counter = counter.add(secondMint)
      await expect(await seekers.currentMaxSeekers() == counter)
      await seekers.activateThirdMint()
      counter = counter.add(thirdMint)
      await expect(await seekers.currentMaxSeekers() == counter)
    })

    it("reverts if the first mint has already been activated", async () => {
      await seekers.activateFirstMint()
      await expect(seekers.activateFirstMint()).to.be.revertedWith(
        "Already active")
    })

    it("reverts if the second mint has already been activated", async () => {
      await seekers.activateSecondMint()
      await expect(seekers.activateSecondMint()).to.be.revertedWith(
        "Already active")
    })

    it("reverts if the third mint has already been activated", async () => {
      await seekers.activateThirdMint()
      await expect(seekers.activateThirdMint()).to.be.revertedWith(
        "Already active")
    })
  })

  describe("allImmortalOwners", () => {

    let holdTime = 1
    it("reverts if there is not a token minted yet", async () => {
      await expect(seekers.allImmortalOwners()).to.be.revertedWith(
        "There must be at least one token.")
    })

    it("returns the immortal owner list", async () => {
      let holders = [userA.address, userB.address]
      await seekers.issueImmortal(userA.address, holdTime)
      await seekers.issueImmortal(userB.address, holdTime)
      await seekers.activateFirstMint() 
      await seekers.connect(userC).issueSeeker()
      expect(await seekers.allImmortalOwners()).to.eql(holders)
    })
  })

  describe("allSeekerOwners", () => {

    let holdTime = 1
    it("reverts if there is not a token minted yet", async () => {
      await expect(seekers.allSeekerOwners()).to.be.revertedWith(
        "There must be at least one token.")
    })

    it("returns the seeker owner list", async () => {
      let holders = [userB.address, userC.address]
      await seekers.issueImmortal(userA.address, holdTime)
      await seekers.activateFirstMint() 
      await seekers.connect(userB).issueSeeker()
      await seekers.connect(userC).issueSeeker()
      expect(await seekers.allSeekerOwners()).to.eql(holders)
    })
  })
})
