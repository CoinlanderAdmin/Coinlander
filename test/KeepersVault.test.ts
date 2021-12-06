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
      expect(await kv.connect(userA).mintFragments(userA.address, 1)).to.be.reverted
    })

    it("does not allow someone to mint more fragments than are available", async () => {
      let max = (await kv.MAXFRAGMENTS()) + 1
      expect(await kv.mintFragments(userA.address, max)).to.be.reverted
    })

    it("mints the correct number of fragments", async () => {
      await kv.mintFragments(userA.address, 1)
      let n1 = await kv.balanceOf(userA.address,1)
      let n2 = await kv.balanceOf(userA.address,2)
      let n3 = await kv.balanceOf(userA.address,3)
      let n4 = await kv.balanceOf(userA.address,4)
      let n5 = await kv.balanceOf(userA.address,5)
      let n6 = await kv.balanceOf(userA.address,6)
      let n7 = await kv.balanceOf(userA.address,7)
      let n8 = await kv.balanceOf(userA.address,8)
      let N = n1.add(n2).add(n3).add(n4).add(n5).add(n6).add(n7).add(n8)
      expect(N).to.be.equal(1)
    })

    it("creates the correct number of each fragment", async () => {
      let max = await kv.MAXFRAGMENTS()
      await kv.mintFragments(userA.address, max)

      let n1 = await kv.balanceOf(userA.address,1)
      let N1 = await kv.numT1()
      expect(n1).to.equal(N1)
      
      let n2 = await kv.balanceOf(userA.address,2)
      let N2 = await kv.numT2()
      expect(n2).to.equal(N2)

      let n3 = await kv.balanceOf(userA.address,3)
      let N3 = await kv.numT3()
      expect(n3).to.equal(N3)

      let n4 = await kv.balanceOf(userA.address,4)
      let N4 = await kv.numT4()
      expect(n4).to.equal(N4)

      let n5 = await kv.balanceOf(userA.address,5)
      let N5 = await kv.numT5()
      expect(n5).to.equal(N5)

      let n6 = await kv.balanceOf(userA.address,6)
      let N6 = await kv.numT6()
      expect(n6).to.equal(N6)

      let n7 = await kv.balanceOf(userA.address,7)
      let N7 = await kv.numT7()
      expect(n7).to.equal(N7)

      let n8 = await kv.balanceOf(userA.address,8)
      let N8 = await kv.numT8()
      expect(n8).to.equal(N8)

    })
  })

})
