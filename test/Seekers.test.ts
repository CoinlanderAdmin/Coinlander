import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Seekers__factory, Seekers } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"
import { toUtf8Bytes } from "@ethersproject/strings";
import "hardhat-gas-reporter"

describe("Seekers", function () {
  
  let owner: SignerWithAddress
  let userA: SignerWithAddress
  let userB: SignerWithAddress
  let userC: SignerWithAddress
  let accounts: SignerWithAddress[]
  let Seekers: Seekers__factory
  let seekers: Seekers

  let KEEPERS_ROLE = ethers.utils.keccak256(toUtf8Bytes("KEEPERS_ROLE"))
  let GAME_ROLE = ethers.utils.keccak256(toUtf8Bytes("GAME_ROLE"))
  let MAX_MINTABLE = 10
  let FIRST_MINT = 5000
  let SECOND_MINT = 3333
  let THIRD_MINT = 1603
  let KEEPER_SEEKERS = 64

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
      expect(await seekers.name()).to.equal("Coinlander: Seekers")
    })

    it("sets the symbol to SEEK", async () => {
      expect(await seekers.symbol()).to.equal("SEEKERS")
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
      expect(await seekers.hasRole(KEEPERS_ROLE, owner.address)).to.be.true
    })

    it("an existing Keeper can assign the Keepers role", async () => {
      await seekers.addKeeper(userA.address)
      expect(await seekers.hasRole(KEEPERS_ROLE, userA.address)).to.be.true
    })

    it("creates a Game Contract role and it can be assigned", async () => {
      await seekers.addGameContract(owner.address)
      expect(await seekers.hasRole(GAME_ROLE, owner.address)).to.be.true
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
      expect(await seekers.getOriginById(id)).to.be.true
    })
  })

  describe("upon summonSeeker", () => {
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract 
    })

    it("will not allow someone to summon a seeker before the first mint activates", async () => {
      let summonCost = await seekers.currentPrice()
      await expect(seekers.summonSeeker(1, { value: summonCost })).to.be.revertedWith("E-001-003")
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
      await expect(seekers.connect(userA).summonSeeker(3, { value: summonCost.mul(2) })).to.be.revertedWith("E-001-002")
    })

    it("does not allow someone to mint more than the limit number of tokens", async () => {
      await seekers.activateFirstMint()
      let summonCost = await seekers.currentPrice()
      let tooMany = MAX_MINTABLE + 1
      await expect(seekers.connect(userA).summonSeeker(tooMany, { value: summonCost.mul(tooMany) })).to.be.revertedWith("E-001-001")
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

      expect(await seekers.currentBuyableSeekers() == counter)
      await seekers.activateFirstMint()
      counter = counter.add(FIRST_MINT).add(KEEPER_SEEKERS)
      expect(await seekers.currentBuyableSeekers() == counter)

      await seekers.activateSecondMint()
      counter = counter.add(SECOND_MINT)
      expect(await seekers.currentBuyableSeekers() == counter)

      await seekers.activateThirdMint()
      counter = counter.add(THIRD_MINT)
      expect(await seekers.currentBuyableSeekers() == counter)
    })

    it("sets the price correctly upon first mint activation", async () => {
      await seekers.activateFirstMint()
      let price = await seekers.FIRSTMINTPRICE()
      expect(await seekers.currentPrice()).to.equal(price)
    })

    it("reverts if the first mint has already been activated", async () => {
      await seekers.activateFirstMint()
      await expect(seekers.activateFirstMint()).to.be.revertedWith("E-001-005")
    })

    it("sets the price correctly upon second mint activation", async () => {
      await seekers.activateSecondMint()
      let price = await seekers.SECONDMINTPRICE()
      expect(await seekers.currentPrice()).to.equal(price)
    })

    it("reverts if the second mint has already been activated", async () => {
      await seekers.activateSecondMint()
      await expect(seekers.activateSecondMint()).to.be.revertedWith("E-001-006")
    })

    it("sets the price correctly upon third mint activation", async () => {
      await seekers.activateThirdMint()
      let price = await seekers.THIRDMINTPRICE()
      expect(await seekers.currentPrice()).to.equal(price)
    })

    it("reverts if the third mint has already been activated", async () => {
      await seekers.activateThirdMint()
      await expect(seekers.activateThirdMint()).to.be.revertedWith("E-001-007")
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
      await expect(seekers.sendWinnerSeeker(userB.address)).to.be.revertedWith("E-001-008")
    })

    it("does not let a non game contract call the method", async () => {
      await expect(seekers.connect(userA).sendWinnerSeeker(userB.address)).to.be.reverted
    })
  })

  describe("upon performCloakingCeremony", () => {
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract 
    })

    it("set the cloaking boolean to true", async () => {
      expect(await seekers.cloakingAvailable()).to.be.false
      await seekers.performCloakingCeremony()
      expect(await seekers.cloakingAvailable()).to.be.true
    })
  })

  describe("upon cloakSeeker", () => {
    let id: BigNumber 
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract
      await seekers.birthSeeker(userA.address)
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
    })

    it("requires the cloaking ceremony has been reached", async () => {
      await expect(seekers.connect(userA).cloakSeeker(id)).to.be.revertedWith("E-001-009")
    })

    it("allows the owner of a token to cloak their own seeker", async () => {
      await seekers.performCloakingCeremony()
      await expect(seekers.connect(userA).cloakSeeker(id))
    })

    it("does not allow a seeker to be cloaked more than once", async () => {
      await seekers.performCloakingCeremony()
      await seekers.connect(userA).cloakSeeker(id)
      await expect(seekers.connect(userA).cloakSeeker(id)).to.be.revertedWith("E-001-011")
    })

    it("does not allow a non-owner to cloak a seeker", async () => {
      await seekers.performCloakingCeremony()
      await expect(seekers.connect(userB).cloakSeeker(id)).to.be.revertedWith("E-001-010")
    })

    it("assigns non-zero values to APs", async () =>{
      await seekers.performCloakingCeremony()
      await seekers.connect(userA).cloakSeeker(id)
      let APs = await seekers.getApById(id)
      expect(APs[0]).to.be.gt(0)
      expect(APs[1]).to.be.gt(0)
      expect(APs[2]).to.be.gt(0)
      expect(APs[3]).to.be.gt(0)
    })

    it("assigns an alignment", async () => {
      await seekers.performCloakingCeremony()
      await seekers.connect(userA).cloakSeeker(id)
      let alignment = await seekers.getAlignmentById(id)
      expect(alignment).to.not.equal("")
    })

    it("does not change the born from coin attribute", async () => {
      await seekers.performCloakingCeremony()
      const beforeBirth = await seekers.getOriginById(id)
      await seekers.connect(userA).cloakSeeker(id)
      const afterBirth = await seekers.getOriginById(id)
      expect(afterBirth).to.equal(beforeBirth)
    })

    it("does not change the amount of power", async () => {
      await seekers.performCloakingCeremony()
      const beforeScales = await seekers.getPowerById(id)
      await seekers.connect(userA).cloakSeeker(id)
      const afterScales = await seekers.getPowerById(id)
      expect(afterScales).to.equal(beforeScales)
    })

    it("does not change a seekers clan assignment", async () => {
      await seekers.performCloakingCeremony()
      const beforeClan = await seekers.getClanById(id)
      await seekers.connect(userA).cloakSeeker(id)
      const afterClan = await seekers.getClanById(id)
      expect(afterClan).to.equal(beforeClan)
    })

    it("assigns a dethscale pattern", async () => {
      await seekers.performCloakingCeremony()
      let dethscalesBefore = await seekers.getDethscalesById(id)
      expect(dethscalesBefore).to.equal(0);
      await seekers.connect(userA).cloakSeeker(id)
      let dethscalesAfter = await seekers.getDethscalesById(id)
      expect(dethscalesAfter).to.be.greaterThan(0);
    })
  })

  describe("upon rerollDethscales", () => {
    let id: BigNumber 
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract
      await seekers.birthSeeker(userA.address)
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
    })
    
    it("does not let dethscales get rerolled before the cloaking holiday", async () => {
      await expect(seekers.connect(userA).rerollDethscales(id)).to.be.revertedWith("E-001-009")
    })

    it("does not let dethscales get rerolled by a non owner", async () => {
      await seekers.performCloakingCeremony()
      await expect(seekers.connect(userB).rerollDethscales(id)).to.be.revertedWith("E-001-010")
    })

    it("requires that the seeker has been cloaked", async () => {
      await seekers.performCloakingCeremony()
      await expect(seekers.connect(userA).rerollDethscales(id)).to.be.revertedWith("E-001-012")
      await seekers.connect(userA).cloakSeeker(id)
      expect(await seekers.connect(userA).rerollDethscales(id))
    })

    it("actually rerolls dethscales", async () => {
      await seekers.performCloakingCeremony()
      await seekers.connect(userA).cloakSeeker(id)
      let beforeDethscales = await seekers.getDethscalesById(id)
      await seekers.connect(userA).rerollDethscales(id)
      let afterDethscales = await seekers.getDethscalesById(id)
      expect(beforeDethscales).to.not.equal(afterDethscales)
    })

    it("requires that the seeker has scales to burn", async () => {
      await seekers.performCloakingCeremony()
      await seekers.connect(userA).cloakSeeker(id)
      let scaleCount = (await seekers.getPowerById(id))
      for(let i=0; i < scaleCount; i++){
        await seekers.connect(userA).rerollDethscales(id)
      }
      await expect(seekers.connect(userA).rerollDethscales(id)).to.be.revertedWith("E-001-021")
    })
  })

  describe("upon burn power", () => {
    let id: BigNumber 
    let ownerId: BigNumber
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // Give owner "game contract" role
      await seekers.birthSeeker(userA.address)
      await seekers.birthSeeker(owner.address)
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
      ownerId = await seekers.tokenOfOwnerByIndex(owner.address,1)
    })

    it("reverts for a non existent token ", async () => {
      await expect(seekers.burnPower(1000, 1)).to.be.reverted
    })

    it("reverts if the caller is not the token owner ", async () => {
      await expect(seekers.burnPower(id, 1)).to.be.revertedWith("E-001-010")
    })

    it("reverts if the token power is less than the power being burned ", async () => {
      await expect(seekers.burnPower(ownerId, 10)).to.be.revertedWith("E-001-021")
    })

    it("allows a token owner to burn power from their seeker", async () => {
      let powerStart = await seekers.getPowerById(ownerId)
      console.log(powerStart)
      await seekers.burnPower(ownerId, 1)
      let powerEnd = await seekers.getPowerById(ownerId)
      expect(powerStart).to.be.equal(powerEnd + 1)
    })
  })

  describe("upon getFullCloak", () => {
    let id: BigNumber 
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract
      await seekers.birthSeeker(userA.address)
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
    })

    it("reverts for a cloaked seeker", async () => {
      await expect(seekers.getFullCloak(id)).to.be.revertedWith("E-001-012")
    })

    it("returns an array of the expected length", async () => {
      await seekers.performCloakingCeremony()
      await seekers.connect(userA).cloakSeeker(id)
      let fullCloak = await seekers.getFullCloak(id)
      expect(fullCloak.length).to.equal(32)
    })

    it("returns the same cloak across multiple calls", async () => {
      await seekers.performCloakingCeremony()
      await seekers.connect(userA).cloakSeeker(id)
      let firstFullCloak = await seekers.getFullCloak(id)
      let secondFullCloak = await seekers.getFullCloak(id)
      function arrayEquiv(element: number, index: number, array: Array<number>) {
        return element == secondFullCloak[index]
      }
      expect(firstFullCloak.every(arrayEquiv))
    })
  })

  describe("upon addPower", () => {
    let id: BigNumber 
    beforeEach(async function () {
      seekers = await Seekers.deploy()
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract
      await seekers.birthSeeker(userA.address)
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
    })
    
    it("does not let power get added to nonexistent tokens", async () => {
      await expect(seekers.addPower(id.add(1),1)).to.be.reverted
    })

    it("requires a non-zero power amount", async () => {
      await expect(seekers.addPower(id,0)).to.be.revertedWith("E-001-015")
    })

    it("adds the correct amount of power to the seeker", async () => {
      let beforeScales = await seekers.getPowerById(id)
      await seekers.addPower(id,1)
      let afterScales = await seekers.getPowerById(id)
      expect(afterScales).to.be.equal(beforeScales + 1)
    })

    it("does not set the power amount higher than the max power value", async () => {
      let maxScales = await seekers.MAXPOWER()
      await seekers.addPower(id,(maxScales + 1))
      expect(await seekers.getPowerById(id)).to.equal(maxScales)
    })
  })
})