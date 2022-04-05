import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Vault__factory, Vault } from "../typechain"
import { Seekers__factory, Seekers } from "../typechain"
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
    ;[owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
    Vault = (await ethers.getContractFactory(
      "Vault",
      owner
    )) as Vault__factory
    kv = await Vault.deploy()
  })

  it("can be deployed", async function () {
    await kv.deployed()
  })
  
  it("sets the deployer as owner", async function () { 
    let currentOwner = await kv.owner()
    expect(currentOwner).to.equal(owner.address)
  })
  
  describe("upon mintFragments", () => {
    before(async function () {
      kv = await Vault.deploy()
    })

    it("allows the owner to mint", async () => {
      expect(await kv.mintFragments(userC.address, 1))
    })

    it("does not allow a non owner to mint", async () => {
      await expect(kv.connect(userA).mintFragments(userA.address, 1)).to.be.reverted
    })

    it("does not allow someone to mint more fragments than are available", async () => {
      let max = (await kv.MAXFRAGMENTS()) + 1
      await expect(kv.mintFragments(userA.address, max)).to.be.reverted
    })

    it("mints the specified number of fragments", async () => {
      await kv.mintFragments(userB.address, 1)
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

  describe("upon minting all Fragments", () => {
    before(async function () {
      kv = await Vault.deploy()
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
      kv = await Vault.deploy() // get a fresh contract instance 
      // Mint all the fragments for userA 
      const max = await kv.MAXFRAGMENTS()
      for(let i = 0; i < max; i++) {
        await kv.mintFragments(userA.address, 1)
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
