import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Citizens__factory, Citizens } from "../typechain"
import { Seekers__factory, Seekers } from "../typechain"
import { Vault__factory, Vault } from "../typechain"
import { Cloak__factory, Cloak } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"
import { timeStamp } from "console"
import { MerkleTree } from 'merkletreejs'

const keccak256  = require('keccak256')



// TODO: migrate the shard tests to a post-emulate validation file 
// A lot of the tests here are broken as a result of the ShardSpendable event.  
// These tests need to be run against a chain that has reached Sweet Release 

describe("Citizens", function () {
    // Users 
    let owner: SignerWithAddress
    let userA: SignerWithAddress
    let userB: SignerWithAddress
    let userC: SignerWithAddress
    let accounts: SignerWithAddress[]

    // Contracts 
    let CloakLib: Cloak__factory
    let cloak: Cloak
    let Citizens_Factory: Citizens__factory
    let citizens: Citizens

    // Merkle Tree 
    let whitelist: Array<String>
    let leaves: Array<Buffer>
    let tree: MerkleTree
    let root: String
  
    before(async function () {
      [owner, userA, userB, userC, ...accounts] = await ethers.getSigners()

      CloakLib = (await ethers.getContractFactory(
        "Cloak",
        owner
      )) as Cloak__factory
      
      cloak = await CloakLib.deploy() 

      whitelist = [userA.address, userB.address]
      leaves = whitelist.map(keccak256)
      tree = new MerkleTree(leaves, keccak256)
      root = "0x" + tree.getRoot().toString('hex')
      console.log(root)
    })

    beforeEach(async function () {
        Citizens_Factory = await ethers.getContractFactory("Citizens") as Citizens__factory
        citizens = await Citizens_Factory.deploy(cloak.address)
        
    })

    describe("during construction", () => {
        it("sets the creator as the owner", async () => {
            expect(owner.address).to.equal(await citizens.owner())
        })
    })

    describe("allows only the owner to set public claim state", () => {
        it("defaults public claim to false", async () => {
            expect(!(await citizens.isPublicClaimActive()))
        })

        it("does not allow a non-owner to set public claim state", async () => {
            await expect(citizens.connect(userA).setIsPublicClaimActive(true)).to.be.reverted
        })

        it("allows the owner to change the state arbitrarily", async () => {
            await citizens.setIsPublicClaimActive(true)
            expect(await citizens.isPublicClaimActive())
            await citizens.setIsPublicClaimActive(false)
            expect(!(await citizens.isPublicClaimActive()))
        })
    })

    describe("allows only the owner to set whitelist claim state", () => {
        it("defaults whitelist claim to false", async () => {
            expect(!(await citizens.isCommunityClaimActive()))
        })

        it("does not allow a non-owner to set whitelist claim state", async () => {
            await expect(citizens.connect(userA).setIsCommunityClaimActive(true)).to.be.reverted
        })

        it("allows the owner to change the state arbitrarily", async () => {
            await citizens.setIsCommunityClaimActive(true)
            expect(await citizens.isCommunityClaimActive())
            await citizens.setIsCommunityClaimActive(false)
            expect(!(await citizens.isCommunityClaimActive()))
        })
    })

    describe("allows only the owner to change whether set cause of death is available", () => {
        it("defaults cod set to true", async () => {
            expect(await citizens.isCauseOfDeathSetActive())
        })

        it("does not allow a non-owner to change cod set state", async () => {
            await expect(citizens.connect(userA).setCauseOfDeathActive(true)).to.be.reverted
        })

        it("allows the owner to change the state arbitrarily", async () => {
            await citizens.setCauseOfDeathActive(false)
            expect(!(await citizens.isCauseOfDeathSetActive()))
            await citizens.setCauseOfDeathActive(true)
            expect(await citizens.isCauseOfDeathSetActive())
        })
    })

    describe("allows only the owner to change the merkle root", () => {
        it("does not allow a non-owner to change the merkle root", async () => {
            await expect(citizens.connect(userA).setListMerkleRoot(tree.getRoot())).to.be.reverted
        })

        it("allows the owner to set the merkle root", async () => {
            await citizens.setListMerkleRoot(tree.getRoot())
            let contractRoot = await citizens.WLMerkleRoot()
            expect(contractRoot).to.equal(root)
        })
    })

    describe("upon claim via whitelist", () => {
        let proof: string[]
        beforeEach(async function () {
            await citizens.setListMerkleRoot(tree.getRoot())
            proof = tree.getHexProof(leaves[0])
        })

        it("does not allow a user to claim before the community claim is active", async () => {
            await expect(citizens.connect(userA).wlClaim(proof)).to.be.revertedWith("E-003-003")
        })

        it("allows a user to claim from the whitelist", async () => {  
            await citizens.setIsCommunityClaimActive(true) 
            await citizens.connect(userA).wlClaim(proof)
            let tokenId = await citizens.tokenOfOwnerByIndex(userA.address,0)
            expect(tokenId.toNumber()).to.equal(1)
        })

        it("does not let someone claim with an invalid proof", async () => {
            await citizens.setIsCommunityClaimActive(true)
            let badProof = proof.concat(proof[0]) // jam more data into proof 
            await expect(citizens.connect(userA).wlClaim(badProof)).to.be.revertedWith("E-003-001")
        })

        it("does not let someone claim with someone elses valid proof", async () => {
            await citizens.setIsCommunityClaimActive(true)
            await expect(citizens.connect(userB).wlClaim(proof)).to.be.revertedWith("E-003-001")
        })

        it("does not let someone claim more than once with a valid proof" , async () => {
            await citizens.setIsCommunityClaimActive(true)
            await citizens.connect(userA).wlClaim(proof)
            await expect(citizens.connect(userA).wlClaim(proof)).to.be.revertedWith("E-003-005") 
        })  
    })

    describe("upon public claim", async () => {
        let proof: string[]
        beforeEach(async function () {
            await citizens.setListMerkleRoot(tree.getRoot())
            await citizens.setIsCommunityClaimActive(true)
            proof = tree.getHexProof(leaves[0])
        })

        it("does not let a user claim before public claim is activated", async () => {
            await expect(citizens.connect(userA).publicClaim()).to.be.revertedWith("E-003-002")
        })

        it("allows a WL user who hasnt claimed to claim", async () => {
            await citizens.setIsPublicClaimActive(true)
            await citizens.connect(userA).publicClaim()
            let tokenId = await citizens.tokenOfOwnerByIndex(userA.address,0)
            expect(tokenId.toNumber()).to.be.greaterThan(0)
        })

        it("allows a non-WL user to claim", async () => {
            await citizens.setIsPublicClaimActive(true)
            await citizens.connect(userC).publicClaim()
            let tokenId = await citizens.tokenOfOwnerByIndex(userC.address,0)
            expect(tokenId.toNumber()).to.be.greaterThan(0)
        })

        it("does not let a WL claimant to claim with public", async () => {
            await citizens.setIsPublicClaimActive(true)
            await citizens.connect(userA).wlClaim(proof)
            await expect(citizens.connect(userA).publicClaim()).to.be.revertedWith("E-003-005")
        })
    })

    describe("upon setting and returning base uri", () => {
        let id: BigNumber
        beforeEach(async function () {
            await citizens.setListMerkleRoot(tree.getRoot())
            await citizens.setIsCommunityClaimActive(true)
            let proof = tree.getHexProof(leaves[0])
            await citizens.connect(userA).wlClaim(proof)
            id = await citizens.tokenOfOwnerByIndex(userA.address,0)
        })
    
        it("allows the owner to change the base URI", async () => {
          await citizens.setBaseURI("testString")
          let expectedURI = "testString" + String(id)
          let returnedURI = await citizens.tokenURI(id)
          expect(returnedURI).to.equal(expectedURI)
        })
    
        it("does not allow a non-keeper to change the base URI", async () => {
          await expect(citizens.connect(userA).setBaseURI("testString")).to.be.reverted
        })
    })

    describe("upon setting cause of death", async () => {
        let id: BigNumber
        let cod: string
        beforeEach(async function () {
            await citizens.setIsPublicClaimActive(true)
            await citizens.connect(userA).publicClaim()
            id = await citizens.tokenOfOwnerByIndex(userA.address, 0) 
            cod = ethers.utils.formatBytes32String("anvil fell on head")
        })

        it("allows a token owner to set the CoD", async () => {
            let cod = ethers.utils.formatBytes32String("anvil fell on head")
            await citizens.connect(userA).setCauseOfDeath(id,cod)
            let chainCod = await citizens.getCauseOfDeathById(id)
            expect(chainCod).to.equal(cod)
        })

        it("does not allow a non token owner to set the CoD", async () => {
            await expect(citizens.connect(userB).setCauseOfDeath(id,cod)).to.be.revertedWith("E-003-007")
        })
    })
})