import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { KeepersVault__factory, KeepersVault } from "../typechain"
import { Seekers__factory, Seekers } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"
import { stringify } from "querystring"

describe("KeepersVault", function () {
  let owner: SignerWithAddress
  let userA: SignerWithAddress
  let userB: SignerWithAddress
  let userC: SignerWithAddress
  let accounts: SignerWithAddress[]
  let Seekers: Seekers__factory
  let seekers: Seekers
  let KeepersVault: KeepersVault__factory
  let kv: KeepersVault

  before(async function () {
    ;[owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
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
    await seekers.addGameContract(owner.address)
    kv = await KeepersVault.deploy(seekers.address)
  })

  it("can be deployed", async function () {
    const kv = await KeepersVault.deploy(seekers.address)
    await kv.deployed()
  })
  
  describe("upon mintFragments", () => {
    it("sets the deployer to owner", async () => {
      expect(await kv.mintFragments(userA.address, 1))
    })

    it("does not allow a non owner to mint", async () => {
      await expect(kv.connect(userA).mintFragments(userA.address, 1)).to.be.reverted
    })

    it("does not allow someone to mint more fragments than are available", async () => {
      let max = (await kv.MAXFRAGMENTS()) + 1
      await expect(kv.mintFragments(userA.address, max)).to.be.reverted
    })

    it("mints the specified number of fragments", async () => {
      await kv.mintFragments(userA.address, 1)
      let n1 = await kv.balanceOf(userA.address,0)
      let n2 = await kv.balanceOf(userA.address,1)
      let n3 = await kv.balanceOf(userA.address,2)
      let n4 = await kv.balanceOf(userA.address,3)
      let n5 = await kv.balanceOf(userA.address,4)
      let n6 = await kv.balanceOf(userA.address,5)
      let n7 = await kv.balanceOf(userA.address,6)
      let n8 = await kv.balanceOf(userA.address,7)
      let N = n1.add(n2).add(n3).add(n4).add(n5).add(n6).add(n7).add(n8)
      expect(N).to.be.equal(1)
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
        await kv.mintFragments(userA.address, 1)
      }

      let n1 = await kv.balanceOf(userA.address,0)
      expect(n1).to.equal(N1)

      let n2 = await kv.balanceOf(userA.address,1)      
      expect(n2).to.equal(N2)

      let n3 = await kv.balanceOf(userA.address,2)
      expect(n3).to.equal(N3)

      let n4 = await kv.balanceOf(userA.address,3)
      expect(n4).to.equal(N4)

      let n5 = await kv.balanceOf(userA.address,4)
      expect(n5).to.equal(N5)

      let n6 = await kv.balanceOf(userA.address,5)
      expect(n6).to.equal(N6)

      let n7 = await kv.balanceOf(userA.address,6)
      expect(n7).to.equal(N7)

      let n8 = await kv.balanceOf(userA.address,7)
      expect(n8).to.equal(N8)

      let N = n1.add(n2).add(n3).add(n4).add(n5).add(n6).add(n7).add(n8)
      expect(N).to.equal(max)

    })
  })

  describe("upon fundPrizePurse", () => {
    const v = ethers.utils.parseUnits("1", "ether").toHexString()

    it("accepts payments of ether into the prize balance", async () => {
      await kv.fundPrizePurse( { value: v } )
      expect(await kv.prize()).to.equal(v)
    })

    it("accepts payments of ether into the contract balance", async () => {
      await kv.fundPrizePurse( { value: v } )
      expect(await kv.provider.getBalance(kv.address)).to.equal(v)
    })

    it("does not receive ether without calling the fund method", async () => {
      await expect(owner.sendTransaction({ to: kv.address, value: v })).to.be.reverted
    })
  })

  describe("upon claimKeepersVault", () => {

    before( async function() {
      // Mint all the fragments for userA 
      const max = await kv.MAXFRAGMENTS()
      for(let i = 0; i < max; i++) {
        await kv.mintFragments(userA.address, 1)
      }
      

      // Fund the prize purse
      const v = ethers.utils.parseUnits("1", "ether").toHexString()
      await kv.fundPrizePurse( { value: v } )
    })

    it("does not allow a holder of a seeker without all fragment types to claim", async () => {
      await seekers.birthSeeker(userB.address)
      await expect(kv.connect(userB).claimKeepersVault()).to.be.reverted
    })

    it("does not allow a holder of all fragments without a seeker to claim", async () => {
      await expect(kv.connect(userA).claimKeepersVault()).to.be.reverted
    })

    it("allows a holder of all fragments with a seeker to claim", async () => {
      await seekers.birthSeeker(userA.address)
      await kv.connect(userA).claimKeepersVault()
      let beforeBalance = await userA.getBalance()
      expect(await kv.balanceOf(userA.address, 8)).to.equal(1)
      expect(await userA.getBalance()).to.be.greaterThan(beforeBalance)
    })

    it("does not allow a holder of all fragments with a seeker to claim after the first winner has claimed", async () => {
      await seekers.birthSeeker(userA.address)
      await kv.connect(userA).claimKeepersVault()
      await expect(kv.connect(userA).claimKeepersVault()).to.be.reverted
    })
  })


})
