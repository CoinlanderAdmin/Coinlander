import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Seekers__factory, Seekers } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"

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

  describe("upon uncloakSeeker", () => {
    let id: BigNumber 
    beforeEach(async function () {
      await seekers.addGameContract(owner.address) // to simulate OneCoin contract
    })

    it("Buffed", async () =>{
      await seekers.performUncloaking()
      await seekers.birthSeeker(userA.address)
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
      await seekers.connect(userA).uncloakSeeker(id)
      let APs = await seekers.getApById(id)
      console.log(APs)
      expect(APs[0]).to.be.gt(0)
      expect(APs[1]).to.be.gt(0)
      expect(APs[2]).to.be.gt(0)
      expect(APs[3]).to.be.gt(0)
    })

    it("Not Buffed", async () =>{
      await seekers.performUncloaking()
      await seekers.activateFirstMint()
      let summonCost = await seekers.currentPrice()
      await seekers.connect(userA).summonSeeker(1, { value: summonCost.mul(1) })
      id = await seekers.tokenOfOwnerByIndex(userA.address,0)
      await seekers.connect(userA).uncloakSeeker(id)
      let APs = await seekers.getApById(id)
      console.log(APs)
      expect(APs[0]).to.be.gt(0)
      expect(APs[1]).to.be.gt(0)
      expect(APs[2]).to.be.gt(0)
      expect(APs[3]).to.be.gt(0)
    })

  })

})
