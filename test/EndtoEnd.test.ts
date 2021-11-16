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
  let userAStartingBal: BigNumber
  let userBStartingBal: BigNumber

  before(async function () {
    this.timeout(100000); // This will take a while
    ;[owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
    userAStartingBal = await userA.getBalance()
    userBStartingBal = await userB.getBalance()

    CoinOne = (await ethers.getContractFactory(
      "CoinOne",
      owner
    )) as CoinOne__factory

    Immortals = (await ethers.getContractFactory(
      "Immortals",
      owner
    )) as Immortals__factory


    // Deploy the contracts and assign the OneCoin contract as owner of the Immortal contract 
    immortals = await Immortals.deploy()
    coinOne = await CoinOne.deploy(immortals.address)
    await immortals.transferOwnership(coinOne.address)

    // Repeat stealing until the release 
    let maxTokens: BigNumber
    let SS: BigNumber
    maxTokens = await immortals.maxImmortals()
    const testIters = maxTokens.toNumber()/2
    for(let i = 0; i < testIters; i++) {
        // User A steals
        SS = await coinOne.seizureStake()
        await coinOne.connect(userA).steal({ value: SS })
        if(i != 0){
            await coinOne.connect(userB).withdrawDeposit()
        }
        // User B steals
        SS = await coinOne.seizureStake()
        await coinOne.connect(userB).steal({ value: SS })
        await coinOne.connect(userA).withdrawDeposit()
    }
    // Handle odd last case
    SS = await coinOne.seizureStake()
    await coinOne.connect(userA).steal({ value: SS })
  })

  describe("stealing the coinlander", () => { 

    it("can reach the release", async () => {
      expect(await coinOne.released()).to.equal(true)
    })

    it("has earned userB 555 immortals", async () => {
      let userBImmos = await immortals.balanceOf(userB.address)
      expect(userBImmos.toNumber()).to.equal(555)
    })

    // This should incorporate the financial model once it's been finalzed
    it("has cost a fuck load of eth to do so", async () => {
      let userBBal: BigNumber
      userBBal = await userB.getBalance()
      console.log(userBStartingBal.sub(userBBal))
      expect(userBBal.lt(userBStartingBal)).to.be.true
    })

    it("Should be possible to mint a seeker", async () => {
      await immortals.connect(userC).issueSeeker()
      expect(await immortals.balanceOf(userC.address)).to.equal(1)
    })

})
})