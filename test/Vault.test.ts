import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Vault__factory, Vault } from "../typechain"
import { expect } from "chai"
import { BigNumber } from "ethers"

describe("Vault", function () {
  let owner: SignerWithAddress
  let userA: SignerWithAddress
  let userB: SignerWithAddress
  let userC: SignerWithAddress
  let accounts: SignerWithAddress[]
  let Vault: Vault__factory
  let kv: Vault

  before(async function () {
    [owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
    Vault = (await ethers.getContractFactory(
      "Vault",
      owner
    )) as Vault__factory
    kv = await Vault.deploy(owner.address)
  })

  it("can be deployed", async function () {
    await kv.deployed()
  })
  
  it("sets the deployer as owner", async function () { 
    let currentOwner = await kv.owner()
    expect(currentOwner).to.equal(owner.address)
  })

  it("allows the game contract to be set", async function () {
    // expect that the owner cannot mint at first
    await expect(kv.requestFragments(userA.address,1)).to.be.revertedWith("E-002-015")
    let tx =await kv.setGameContract(owner.address)
    expect(kv.requestFragments(userA.address,1))
  })
  
  describe("upon requestFragments", () => {
    before(async function () {
      kv = await Vault.deploy(owner.address)
      await kv.setGameContract(owner.address) // use owner address in lieu of game contract
    })

    it("allows the specified game contract to request fragments", async () => {
      expect(await kv.requestFragments(userC.address, 1))
    })

    it("does not allow a non approved address to mint", async () => {
      await expect(kv.connect(userA).requestFragments(userA.address, 1)).to.be.revertedWith("E-002-015")
    })

    it("does not allow someone to mint more fragments than are available", async () => {
      let overMax = (await kv.MAXFRAGMENTS()) + 1
      await expect(kv.requestFragments(userA.address, overMax)).to.be.revertedWith("E-002-009")
    })

    it("mints the specified number of fragments", async () => {
      await kv.requestFragments(userB.address, 1)
      let r = await kv.requestId()
      await kv.fulfillRequest(r)
      await kv.connect(userB).claimFragments()
      let n1 = await kv.balanceOf(userB.address,1)
      let n2 = await kv.balanceOf(userB.address,2)
      let n3 = await kv.balanceOf(userB.address,3)
      let n4 = await kv.balanceOf(userB.address,4)
      let n5 = await kv.balanceOf(userB.address,5)
      let n6 = await kv.balanceOf(userB.address,6)
      let n7 = await kv.balanceOf(userB.address,7)
      let n8 = await kv.balanceOf(userB.address,8)
      let N = n1.add(n2).add(n3).add(n4).add(n5).add(n6).add(n7).add(n8)
      expect(N).to.be.equal(1)
    })
  })

  describe("upon setRandomnessOracle", () => {
    beforeEach(async function () {
      kv = await Vault.deploy(owner.address)
      await kv.setGameContract(owner.address)
    })

    it("only allows an owner to call it", async () => {
      await expect(kv.connect(userA).setRandomnessOracle(userA.address)).to.be.reverted
    })

    it("allows the owner to change the oracle", async () => {
      await expect(kv.setRandomnessOracle(userA.address))
      expect(await kv.randomnessOracle()).to.equal(userA.address)
    })
  })

  describe("upon requestFragments", () => {
    let n: number
    let r: number
    beforeEach(async function () {
      kv = await Vault.deploy(owner.address)
      await kv.setGameContract(owner.address)
    })

    it("properly increments the request id", async () => {
      n = 2
      await kv.requestFragments(userA.address,n)
      r = await kv.requestId()
      expect(r).to.equal(n)
    })

    it("records the request correctly", async () => {
      n = 1
      await kv.requestFragments(userA.address,n) 
      r = await kv.requestId()
      let a: boolean
      let b: string
      [a,b] = await kv.requestFulfillments(r)
      expect(!a)
      expect(b).to.equal(userA.address)
    })
  })

  describe("upon fulfillRequest", () => {
    let n: number
    beforeEach(async function () {
      kv = await Vault.deploy(owner.address)
      await kv.setGameContract(owner.address)
      n = 2
      await kv.requestFragments(userA.address,n)
    })

    it("only lets the oracle call this", async () => {
      await (expect (kv.connect(userA).fulfillRequest(1))).to.be.reverted
    })

    it("fulfills the proper request", async () => {
      await kv.fulfillRequest(1)
      let a1: boolean
      let a2: boolean
      [a1,] = await kv.requestFulfillments(1);
      [a2,] = await kv.requestFulfillments(2);
      expect(a1)
      expect(!a2)
    })

    it("will not fulfill a request twice", async () => {
      await kv.fulfillRequest(1)
      await expect(kv.fulfillRequest(1)).to.be.revertedWith("E-002-017")
    })

    it("will not fulfill for an invalid request id", async () => {
      await expect(kv.fulfillRequest(n+1)).to.be.revertedWith("E-002-020")
    })

    it("sets the claimable for the requester", async () => {
      await kv.fulfillRequest(1)
      let c = await kv.claimables(userA.address,0)
      expect(c).to.be.gt(0)
    })

    it("can set multiple claimables", async () => {
      await kv.fulfillRequest(1)
      await kv.fulfillRequest(2)
      let c1 = await kv.claimables(userA.address,0)
      let c2 = await kv.claimables(userA.address,1)
      expect(c1).to.be.gt(0)
      expect(c2).to.be.gt(0)
      await expect(kv.claimables(userA.address,2)).to.be.reverted
    })
  })

  describe("upon claimFragments", () => {
    let n: number
    beforeEach(async function () {
      kv = await Vault.deploy(owner.address)
      await kv.setGameContract(owner.address)
      n = 2
      await kv.requestFragments(userA.address,n)
      await kv.fulfillRequest(1)
    })

    it("requires that there be something to claim", async () => {
      await expect(kv.connect(userB).claimFragments()).to.be.revertedWith("E-002-018")
    })

    it("allows someone with claimables to claim once", async () => {
      await kv.connect(userA).claimFragments()
      await expect(kv.connect(userA).claimFragments()).to.be.revertedWith("E-002-018")
    })

    it("mints the correct fragment for the claimer", async () => {
      let f = await kv.claimables(userA.address,0)
      await kv.connect(userA).claimFragments()
      let bal = await kv.balanceOf(userA.address, f)
      expect(bal.toNumber()).to.equal(1)
    })

    it("allows a user to claim multiple fragments at a time", async () => {
      await kv.fulfillRequest(2)
      let f1 = await kv.claimables(userA.address,0)
      let f2 = await kv.claimables(userA.address,1)
      await kv.connect(userA).claimFragments()
      let bal1 = await kv.balanceOf(userA.address, f1)
      let bal2 = await kv.balanceOf(userA.address, f2)
      expect(bal1.toNumber()).to.be.gt(0)
      expect(bal2.toNumber()).to.be.gt(0)
    })
  })

  describe("correctly handles multiple requests from different users", () => {
    let n: number
    let ra: number
    let rb: number
    let r: number 
    beforeEach(async function () {
      kv = await Vault.deploy(owner.address)
      await kv.setGameContract(owner.address)
      await kv.requestFragments(userA.address, 1)
      ra = await kv.requestId()
      await kv.requestFragments(userB.address, 1)
      rb = await kv.requestId()
      n = 2
    })

    it("properly increments the request id", async () => {
      expect(ra).to.equal(1)
      expect(rb).to.equal(2)
    })

    it("allows the oracle to fulfill each request separately", async () => {
      await kv.fulfillRequest(ra)
      expect((await kv.requestFulfillments(ra))[0])
      expect(!(await kv.requestFulfillments(rb))[0])
      await kv.fulfillRequest(rb)
      expect((await kv.requestFulfillments(rb))[0])
    })

    it("allows the fulfillments to be processed in arbitrary orders", async () => {
      await kv.fulfillRequest(rb)
      expect((await kv.requestFulfillments(rb))[0])
      expect(!(await kv.requestFulfillments(ra))[0])
      await kv.fulfillRequest(ra)
      expect((await kv.requestFulfillments(ra))[0])
    })

  })

  describe("upon minting all Fragments", () => {
    before(async function () {
      kv = await Vault.deploy(owner.address)
      await kv.setGameContract(owner.address)
    })

    it("creates the correct number of each fragment", async () => {
      const max = await kv.MAXFRAGMENTS()
      const N1 = await kv.numT1()
      const N2 = await kv.numT2()
      const N3 = await kv.numT3()
      const N4 = await kv.numT4()
      const N5 = await kv.numT5()
      const N6 = await kv.numT6()
      const N7 = await kv.numT7()
      const N8 = await kv.numT8()

      // This runs out of gas if we mint them all at once
      for(let i = 0; i < max; i++) {
        await kv.requestFragments(userA.address, 1)
        let r = await kv.requestId()
        await kv.fulfillRequest(r)
        await kv.connect(userA).claimFragments()
      }

      let n1 = await kv.balanceOf(userA.address,1)
      expect(n1).to.equal(N1)

      let n2 = await kv.balanceOf(userA.address,2)      
      expect(n2).to.equal(N2)

      let n3 = await kv.balanceOf(userA.address,3)
      expect(n3).to.equal(N3)

      let n4 = await kv.balanceOf(userA.address,4)
      expect(n4).to.equal(N4)

      let n5 = await kv.balanceOf(userA.address,5)
      expect(n5).to.equal(N5)

      let n6 = await kv.balanceOf(userA.address,6)
      expect(n6).to.equal(N6)

      let n7 = await kv.balanceOf(userA.address,7)
      expect(n7).to.equal(N7)

      let n8 = await kv.balanceOf(userA.address,8)
      expect(n8).to.equal(N8)

      let N = n1.add(n2).add(n3).add(n4).add(n5).add(n6).add(n7).add(n8)
      expect(N).to.equal(max)

    })
  })

  describe("upon fundPrizePurse", () => {
    const v = ethers.utils.parseUnits("1", "ether")

    it("accepts payments of ether into the prize balance", async () => {
      await kv.fundPrizePurse( { value: v } )
      expect(await kv.prize()).to.equal(v)
    })

    it("does not receive ether without calling the fund method", async () => {
      await expect(owner.sendTransaction({ 
        to: kv.address, 
        value: v }))
        .to.be.revertedWith("E-002-014")
    })
  })

  describe("upon claimVault", () => {
    let v: BigNumber
    before( async function() {
      kv = await Vault.deploy(owner.address) // get a fresh contract instance 
      await kv.setGameContract(owner.address)
      // Mint all the fragments for userA 
      const max = await kv.MAXFRAGMENTS()
      for(let i = 0; i < max; i++) {
        await kv.requestFragments(userA.address, 1)
        let r = await kv.requestId()
        await kv.fulfillRequest(r)
        await kv.connect(userA).claimFragments()
      }
      // Fund the prize purse
      v = ethers.utils.parseUnits("1", "ether")
      await kv.fundPrizePurse( { value: v } )
    })

    it("does not allow anyone to claim before the sweet release has been triggered", async () => {
      await expect(kv.connect(userB).claimKeepersVault()).to.be.revertedWith("E-002-010")
    })

    it("does not allow a user without all fragment types to claim", async () => {
      await kv.setSweetRelease()
      await kv.fundPrizePurse( { value: v } )
      await expect(kv.connect(userB).claimKeepersVault()).to.be.revertedWith("E-002-001")
    })

    it("allows a holder of all fragments to claim", async () => {
      let beforeBalance = await userA.getBalance()
      await kv.connect(userA).claimKeepersVault()
      expect(await kv.balanceOf(userA.address, 0)).to.equal(1) // has key 
      let afterBalance = await userA.getBalance()
      expect(afterBalance.gt(beforeBalance)).to.be.true // received prize pool funds 
    })

    it("does not allow a holder of all fragments to claim after the first winner has claimed", async () => {
      await expect(kv.connect(userA).claimKeepersVault()).to.be.revertedWith("E-002-011")
    })
  })
})
