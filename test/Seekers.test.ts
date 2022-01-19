import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Seekers__factory, Seekers } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"
import { stringify } from "querystring"
import "hardhat-gas-reporter"

describe("Seekers", function () {
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

    it("mints the winning seeker and gives it to the deployer", async () => {
      expect(await seekers.balanceOf(owner.address)).to.equal(1)
    })
  })
  
  describe("enables Access Controls", () => {
    it("sets the deployer to admin", async () => {
      expect(await seekers.hasRole(await (seekers.DEFAULT_ADMIN_ROLE()), owner.address)).to.be.true
    })

    it("creates a Keepers role and assigns it to the deployer", async () => {
      expect(await seekers.hasRole(await (seekers.KEEPERS_ROLE()), owner.address)).to.be.true
    })

    it("an existing Keeper can assign the Keepers role", async () => {
      await seekers.addKeeper(userA.address)
      expect(await seekers.hasRole(await (seekers.KEEPERS_ROLE()), userA.address)).to.be.true
    })

    it("creates a Game Contract role and it can be assigned", async () => {
      await seekers.addGameContract(owner.address)
      expect(await seekers.hasRole(await (seekers.GAME_ROLE()), owner.address)).to.be.true
    })
  })

  describe("upon setting and returning base uri", () => {
    let id: BigNumber
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract
      await seekers.birthSeeker(userA.address) 
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
    })

    it("allows a keeper to change the base URI", async () => {
      await seekers.setBaseURI("testString")
      let expectedURI = "testString" + String(id)
      let returnedURI = await seekers.tokenURI(id)
      expect(returnedURI).to.equal(expectedURI)
    })

    it("does not allow a non-keeper to change the base URI", async () => {
      await expect(seekers.connect(userA).setBaseURI("testString")).to.be.reverted
    })
  })

  describe("upon birthSeeker", () => {
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // Give owner "game contract" role in place of OneCoin
    })

    it("births a seeker for the assigned user", async () => {
      await seekers.birthSeeker(userA.address)
      expect(await seekers.balanceOf(userA.address)).to.equal(1)
    })

    it("does not let an unapproved user birth a seeker", async () => {
      await expect(seekers.connect(userA).birthSeeker(userA.address)).to.be.reverted
    })
    
    it("assigns a birthed seeker the bornFromCoin attribute", async () => {
      await seekers.birthSeeker(userA.address)
      let id = await seekers.tokenOfOwnerByIndex(userA.address,0)
      expect(await seekers.getBirthStatusById(id)).to.be.true
    })
  })

  describe("upon summonSeeker", () => {
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract 
    })

    it("will not allow someone to summon a seeker before the first mint activates", async () => {
      let summonCost = await seekers.currentPrice()
      await expect(seekers.summonSeeker(1, { value: summonCost })).to.be.reverted
    })

    
    it("will let someone purchase a valid number of tokens for a valid price", async () => {
      await seekers.activateFirstMint()
      let summonCost = await seekers.currentPrice()
      await seekers.connect(userA).summonSeeker(3, { value: summonCost.mul(3) })
      expect(await seekers.balanceOf(userA.address)).to.equal(3)
    })

    it("will not let someone purchase a valid number of tokens for an invalid price", async () => {
      await seekers.activateFirstMint()
      let summonCost = await seekers.currentPrice()
      await expect(seekers.connect(userA).summonSeeker(3, { value: summonCost.mul(2) })).to.be.reverted
    })

    it("does not allow someone to mint more than the limit number of tokens", async () => {
      await seekers.activateFirstMint()
      let summonCost = await seekers.currentPrice()
      let maxMintable = await seekers.MAXMINTABLE()
      let tooMany = maxMintable.add(1)
      await expect(seekers.connect(userA).summonSeeker(tooMany, { value: summonCost.mul(tooMany) })).to.be.reverted
    })
  })

  describe("upon getSeekerCount", () => {
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract 
    })

    it("returns 1 before any seekers are minted to summoned", async () => {
      expect(await seekers.totalSupply()).to.equal(1)
    })

    it("returns 2 after a single seeker has been birthed", async () => {
      await seekers.birthSeeker(userA.address)
      expect(await seekers.totalSupply()).to.equal(2)
    })

    it("returns 2 after a single seeker has been summoned", async () => {
      await seekers.activateFirstMint()
      let price = await seekers.FIRSTMINTPRICE()
      await seekers.connect(userA).summonSeeker(1, {value: price})
      expect(await seekers.totalSupply()).to.equal(2)
    })

    it("returns 3 after one is summoned and one is birthed", async () => {
      await seekers.birthSeeker(userA.address)
      await seekers.activateFirstMint()
      let price = await seekers.FIRSTMINTPRICE()
      await seekers.connect(userA).summonSeeker(1, {value: price})
      expect(await seekers.totalSupply()).to.equal(3)
    })
  })


  describe("upon activatingMints", () => {
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract 
    })

    it("properly incrememnts the buyable seeker count upon mint activations", async () => {
      let counter = await seekers.currentBuyableSeekers()
      const firstMint = await seekers.FIRSTMINT()
      const secondMint = await seekers.SECONDMINT()
      const thirdMint = await seekers.THIRDMINT()

      expect(await seekers.currentBuyableSeekers() == counter)
      await seekers.activateFirstMint()
      counter = counter.add(firstMint)
      expect(await seekers.currentBuyableSeekers() == counter)

      await seekers.activateSecondMint()
      counter = counter.add(secondMint)
      expect(await seekers.currentBuyableSeekers() == counter)

      await seekers.activateThirdMint()
      counter = counter.add(thirdMint)
      expect(await seekers.currentBuyableSeekers() == counter)
    })

    it("sets the price correctly upon first mint activation", async () => {
      await seekers.activateFirstMint()
      let price = await seekers.FIRSTMINTPRICE()
      expect(await seekers.currentPrice()).to.equal(price)
    })

    it("reverts if the first mint has already been activated", async () => {
      await seekers.activateFirstMint()
      await expect(seekers.activateFirstMint()).to.be.reverted
    })

    it("sets the price correctly upon second mint activation", async () => {
      await seekers.activateSecondMint()
      let price = await seekers.SECONDMINTPRICE()
      expect(await seekers.currentPrice()).to.equal(price)
    })

    it("reverts if the second mint has already been activated", async () => {
      await seekers.activateSecondMint()
      await expect(seekers.activateSecondMint()).to.be.reverted
    })

    it("sets the price correctly upon third mint activation", async () => {
      await seekers.activateThirdMint()
      let price = await seekers.THIRDMINTPRICE()
      expect(await seekers.currentPrice()).to.equal(price)
    })

    it("reverts if the third mint has already been activated", async () => {
      await seekers.activateThirdMint()
      await expect(seekers.activateThirdMint()).to.be.reverted
    })
  })

  describe("upon sendWinnerSeeker", () => {
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract 
    })

    it("sends the winner token id 1", async () => {
      await seekers.sendWinnerSeeker(userA.address)
      expect(await seekers.balanceOf(userA.address)).to.equal(1)
      expect(await seekers.ownerOf(1)).to.equal(userA.address)
    })

    it("does not let the method get called more than once", async () => {
      await seekers.sendWinnerSeeker(userA.address)
      await expect(seekers.sendWinnerSeeker(userB.address)).to.be.reverted
    })

    it("does not let a non game contract call the method", async () => {
      await expect(seekers.connect(userA).sendWinnerSeeker(userB.address)).to.be.reverted
    })
  })

  describe("upon performUncloaking", () => {
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract 
    })

    it("set the uncloaking boolean to true", async () => {
      expect(await seekers.uncloaking()).to.be.false
      await seekers.performUncloaking()
      expect(await seekers.uncloaking()).to.be.true
    })
  })

  describe("upon uncloakSeeker", () => {
    let id: BigNumber 
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract
      await seekers.birthSeeker(userA.address)
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
    })

    it("requires the uncloaking ceremony has been reached", async () => {
      await expect(seekers.connect(userA).uncloakSeeker(id)).to.be.reverted
    })

    it("allows the owner of a token to uncloak their own seeker", async () => {
      await seekers.performUncloaking()
      await expect(seekers.connect(userA).uncloakSeeker(id))
    })

    it("does not allow a seeker to be uncloaked more than once", async () => {
      await seekers.performUncloaking()
      await seekers.connect(userA).uncloakSeeker(id)
      await expect(seekers.connect(userA).uncloakSeeker(id)).to.be.reverted
    })

    it("does not allow a non-owner to uncloak a seeker", async () => {
      await seekers.performUncloaking()
      await expect(seekers.connect(userB).uncloakSeeker(id)).to.be.reverted
    })

    it("assigns non-zero values to APs", async () =>{
      await seekers.performUncloaking()
      await seekers.connect(userA).uncloakSeeker(id)
      let APs = await seekers.getApById(id)
      expect(APs[0]).to.be.gt(0)
      expect(APs[1]).to.be.gt(0)
      expect(APs[2]).to.be.gt(0)
      expect(APs[3]).to.be.gt(0)
    })

    it("assigns an alignment", async () => {
      await seekers.performUncloaking()
      await seekers.connect(userA).uncloakSeeker(id)
      let alignment = await seekers.getAlignmentById(id)
      expect(alignment).to.not.equal("")
    })

    it("does not change the born from coin attribute", async () => {
      await seekers.performUncloaking()
      const beforeBirth = await seekers.getBirthStatusById(id)
      await seekers.connect(userA).uncloakSeeker(id)
      const afterBirth = await seekers.getBirthStatusById(id)
      expect(afterBirth).to.equal(beforeBirth)
    })

    it("does not change the number of scales", async () => {
      await seekers.performUncloaking()
      const beforeScales = await seekers.getScaleCountById(id)
      await seekers.connect(userA).uncloakSeeker(id)
      const afterScales = await seekers.getScaleCountById(id)
      expect(afterScales).to.equal(beforeScales)
    })

    it("does not change a seekers clan assignment", async () => {
      await seekers.performUncloaking()
      const beforeClan = await seekers.getClanById(id)
      await seekers.connect(userA).uncloakSeeker(id)
      const afterClan = await seekers.getClanById(id)
      expect(afterClan).to.equal(beforeClan)
    })
  })

  describe("upon addScales", () => {
    let id: BigNumber 
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract
      await seekers.birthSeeker(userA.address)
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
    })
    
    it("does not let scales get added to nonexistant tokens", async () => {
      await expect(seekers.addScales(id.add(1),1)).to.be.reverted
    })

    it("requires a non-zero scale amount", async () => {
      await expect(seekers.addScales(id,0)).to.be.reverted
    })

    it("adds the correct number of scales to the seeker", async () => {
      let beforeScales = await seekers.getScaleCountById(id)
      await seekers.addScales(id,1)
      let afterScales = await seekers.getScaleCountById(id)
      expect(afterScales).to.be.equal(beforeScales.add(1))
    })

    it("does not set the scale count higher than the max pixel count", async () => {
      let maxScales = await seekers.MAXPIXELS()
      await seekers.addScales(id,(maxScales.toNumber() + 1))
      expect(await seekers.getScaleCountById(id)).to.equal(maxScales)
    })
  })
})
