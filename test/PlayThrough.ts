import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { SeasonOne__factory, SeasonOne } from "../typechain"
import { Seekers__factory, Seekers } from "../typechain"
import { Vault__factory, Vault } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"
import { timeStamp } from "console"
import emulate from "../scripts/emulate"
import * as fs from "fs";
import { deploy } from "../scripts/deploy"

// Helpers
async function summonManySeekers(mints: number, user: SignerWithAddress, seekers: Seekers) {
  const maxMints = await (await seekers.MAXMINTABLE()).toNumber()
  let remainingMints = mints
  let currentPrice = await seekers.currentPrice()
  while (remainingMints > 0) {
    if (remainingMints < maxMints) {
      await seekers.connect(user).summonSeeker(remainingMints, {value: currentPrice.mul(remainingMints)})
      remainingMints = 0
    }
    else {
      await seekers.connect(user).summonSeeker(maxMints, {value: currentPrice.mul(maxMints)})
      remainingMints -= maxMints
    }
  }
  return true
}

describe("PlayThrough", function () {
  this.timeout(5000000)

  let owner: SignerWithAddress
  let userA: SignerWithAddress
  let userB: SignerWithAddress
  let userC: SignerWithAddress
  let accounts: SignerWithAddress[]
  let SeasonOne: SeasonOne__factory
  let seasonOne: SeasonOne
  let Seekers: Seekers__factory
  let seekers: Seekers
  let Vault: Vault__factory
  let vault: Vault
  let firstSeekerMintThresh: number
  let secondSeekerMintThresh: number
  let thirdSeekerMintThresh: number
  let uncloakingThresh: number
  let sweetRelease: number
  let uncloaking: boolean
  let released: boolean

  before(async function () {
    [owner, userA, userB, userC, ...accounts] = await ethers.getSigners()
    // await deploy()
    const addressesJson = fs.readFileSync('local/addresses.json', 'utf8');
    const addresses = JSON.parse(addressesJson);

      // Attach to deployed contracts
    Seekers = await ethers.getContractFactory("Seekers");
    seekers = await Seekers.attach(addresses.contracts.seekers);
    Vault = await ethers.getContractFactory("Vault")
    vault = await Vault.attach(addresses.contracts.vault)
    SeasonOne = await ethers.getContractFactory("SeasonOne")
    seasonOne = await SeasonOne.attach(addresses.contracts.seasonOne)
    
      // Get event thresholds
    firstSeekerMintThresh = (await seasonOne.FIRSTSEEKERMINTTHRESH()).toNumber()
    secondSeekerMintThresh = (await seasonOne.SECONDSEEKERMINTTHRESH()).toNumber()
    thirdSeekerMintThresh = (await seasonOne.THIRDSEEKERMINTTHRESH()).toNumber()
    uncloakingThresh = (await seasonOne.UNCLOAKINGTHRESH()).toNumber()
    sweetRelease = (await seasonOne.SWEETRELEASE()).toNumber()
    uncloaking = await seekers.uncloaking()
    released = await seasonOne.released()
  })

  describe("after the first ten seizures", () => {
    before(async function () {
      await emulate(10, ethers)
    })

    it("actually seizes 10 times", async () => {
      expect((await seasonOne.seizureCount()).toNumber()).to.equal(10)
    })
    it("mints 10 seekers", async () => {
      expect((await seekers.totalSupply()).toNumber()).to.equal(10)
    })    

  })

  describe("at the first mint unlock", () => {
    before(async function () {
      await emulate(firstSeekerMintThresh, ethers)
    })

    it("actually seizes up to the first mint", async () => {
      expect((await seasonOne.seizureCount()).toNumber()).to.equal(firstSeekerMintThresh)
    })
    it("sets the first mint bool", async () => {
      expect(await seekers.firstMintActive()).to.be.true
    })
    it("the current seizure stake is the expected price", async () => {
      let SS: number
      SS = ((await seasonOne.seizureStake()).div(10E18)).toNumber()
      expect(SS).to.equal(0.5001079795)
    })

  })

  describe("at the uncloaking", () => {
    before(async function () {
      await emulate(uncloakingThresh, ethers) 
    })
    it("actually seizes up to the uncloaking", async () => {
      expect((await seasonOne.seizureCount()).toNumber()).to.equal(uncloakingThresh)
    })
  })

  describe("at the second mint unlock", () => {
    before(async function () {
      await emulate(secondSeekerMintThresh, ethers)
    })

    it("actually seizes up to the second mint", async () => {
      expect((await seasonOne.seizureCount()).toNumber()).to.equal(secondSeekerMintThresh)
    })
  })

  describe("at the third mint unlock", () => {
    before(async function () {
      await emulate(thirdSeekerMintThresh, ethers)
    })

    it("actually seizes up to the third mint", async () => {
      expect((await seasonOne.seizureCount()).toNumber()).to.equal(thirdSeekerMintThresh)
    })
  })

  describe("at the release", () => {
    before(async function () {
      await emulate(sweetRelease, ethers)
    })

    it("actually seizes up to the sweet release", async () => {
      expect((await seasonOne.seizureCount()).toNumber()).to.equal(sweetRelease)
    })
  })
  
})