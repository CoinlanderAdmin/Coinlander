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

    describe("allows a user to claim via whitelist", () => {
        beforeEach(async function () {
            await citizens.setListMerkleRoot(tree.getRoot())
        })

        it("allows a user to claim from the whitelist", async () => {
            await citizens.setIsCommunityClaimActive(true)
            let proof = tree.getHexProof(leaves[0])
            await citizens.connect(userA).wlClaim(proof)
            let tokenId = await citizens.tokenOfOwnerByIndex(userA.address,0)
            expect(tokenId.toNumber()).to.be.greaterThan(0)
        })
        
    })

    // describe("upon setting and returning base uri", () => {
    //     let id: BigNumber
    //     before(async function () {
    //         await citizens.setListMerkleRoot(tree.getRoot())
    //         await citizens.connect(userA).wlClaim(tree.getProof(leaves[0]))
    //     })
    
    //     it("allows a keeper to change the base URI", async () => {
    //       await seekers.setBaseURI("testString")
    //       let expectedURI = "testString" + String(id)
    //       let returnedURI = await seekers.tokenURI(id)
    //       expect(returnedURI).to.equal(expectedURI)
    //     })
    
    //     it("does not allow a non-keeper to change the base URI", async () => {
    //       await expect(seekers.connect(userA).setBaseURI("testString")).to.be.reverted
    //     })
    //   })



})