import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Formers__factory, Formers } from "../typechain"
import { Cloak__factory, Cloak } from "../typechain"
import { expect } from "chai"
import { BigNumber, utils } from "ethers"
import { timeStamp } from "console"
import { MerkleTree } from 'merkletreejs'

const keccak256  = require('keccak256')

describe("Formers", function () {
    // Users 
    let owner: SignerWithAddress
    let userA: SignerWithAddress
    let userB: SignerWithAddress
    let userC: SignerWithAddress
    let accounts: SignerWithAddress[]

    // Contracts 
    let CloakLib: Cloak__factory
    let cloak: Cloak
    let Formers_Factory: Formers__factory
    let formers: Formers

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
        Formers_Factory = await ethers.getContractFactory("Formers") as Formers__factory
        formers = await Formers_Factory.deploy(cloak.address)
        
    })

    describe("during construction", () => {
        it("sets the creator as the owner", async () => {
            expect(owner.address).to.equal(await formers.owner())
        })
    })

    describe("allows only the owner to set public claim state", () => {
        it("defaults public claim to false", async () => {
            expect(!(await formers.isPublicClaimActive()))
        })

        it("does not allow a non-owner to set public claim state", async () => {
            await expect(formers.connect(userA).setIsPublicClaimActive(true)).to.be.reverted
        })

        it("allows the owner to change the state arbitrarily", async () => {
            await formers.setIsPublicClaimActive(true)
            expect(await formers.isPublicClaimActive())
            await formers.setIsPublicClaimActive(false)
            expect(!(await formers.isPublicClaimActive()))
        })
    })

    describe("allows only the owner to set whitelist claim state", () => {
        it("defaults whitelist claim to false", async () => {
            expect(!(await formers.isCommunityClaimActive()))
        })

        it("does not allow a non-owner to set whitelist claim state", async () => {
            await expect(formers.connect(userA).setIsCommunityClaimActive(true)).to.be.reverted
        })

        it("allows the owner to change the state arbitrarily", async () => {
            await formers.setIsCommunityClaimActive(true)
            expect(await formers.isCommunityClaimActive())
            await formers.setIsCommunityClaimActive(false)
            expect(!(await formers.isCommunityClaimActive()))
        })
    })

    describe("allows only the owner to change whether set cause of death is available", () => {
        it("defaults cod set to true", async () => {
            expect(await formers.isProvenanceSetActive())
        })

        it("does not allow a non-owner to change cod set state", async () => {
            await expect(formers.connect(userA).setProvenanceActive(true)).to.be.reverted
        })

        it("allows the owner to change the state arbitrarily", async () => {
            await formers.setProvenanceActive(false)
            expect(!(await formers.isProvenanceSetActive()))
            await formers.setProvenanceActive(true)
            expect(await formers.isProvenanceSetActive())
        })
    })

    describe("allows only the owner to change the merkle root", () => {
        it("does not allow a non-owner to change the merkle root", async () => {
            await expect(formers.connect(userA).setListMerkleRoot(tree.getRoot())).to.be.reverted
        })

        it("allows the owner to set the merkle root", async () => {
            await formers.setListMerkleRoot(tree.getRoot())
            let contractRoot = await formers.WLMerkleRoot()
            expect(contractRoot).to.equal(root)
        })
    })

    describe("upon claim via whitelist", () => {
        let proof: string[]
        beforeEach(async function () {
            await formers.setListMerkleRoot(tree.getRoot())
            proof = tree.getHexProof(leaves[0])
        })

        it("does not allow a user to claim before the community claim is active", async () => {
            await expect(formers.connect(userA).wlClaim(proof)).to.be.revertedWith("E-003-003")
        })

        it("allows a user to claim from the whitelist", async () => {  
            await formers.setIsCommunityClaimActive(true) 
            await formers.connect(userA).wlClaim(proof)
            let tokenId = await formers.tokenOfOwnerByIndex(userA.address,0)
            expect(tokenId.toNumber()).to.equal(1)
        })

        it("does not let someone claim with an invalid proof", async () => {
            await formers.setIsCommunityClaimActive(true)
            let badProof = proof.concat(proof[0]) // jam more data into proof 
            await expect(formers.connect(userA).wlClaim(badProof)).to.be.revertedWith("E-003-001")
        })

        it("does not let someone claim with someone elses valid proof", async () => {
            await formers.setIsCommunityClaimActive(true)
            await expect(formers.connect(userB).wlClaim(proof)).to.be.revertedWith("E-003-001")
        })

        it("does not let someone claim more than once with a valid proof" , async () => {
            await formers.setIsCommunityClaimActive(true)
            await formers.connect(userA).wlClaim(proof)
            await expect(formers.connect(userA).wlClaim(proof)).to.be.revertedWith("E-003-005") 
        })  
    })

    describe("upon public claim", async () => {
        let proof: string[]
        beforeEach(async function () {
            await formers.setListMerkleRoot(tree.getRoot())
            await formers.setIsCommunityClaimActive(true)
            proof = tree.getHexProof(leaves[0])
        })

        it("does not let a user claim before public claim is activated", async () => {
            await expect(formers.connect(userA).publicClaim()).to.be.revertedWith("E-003-002")
        })

        it("allows a WL user who hasnt claimed to claim", async () => {
            await formers.setIsPublicClaimActive(true)
            await formers.connect(userA).publicClaim()
            let tokenId = await formers.tokenOfOwnerByIndex(userA.address,0)
            expect(tokenId.toNumber()).to.be.greaterThan(0)
        })

        it("allows a non-WL user to claim", async () => {
            await formers.setIsPublicClaimActive(true)
            await formers.connect(userC).publicClaim()
            let tokenId = await formers.tokenOfOwnerByIndex(userC.address,0)
            expect(tokenId.toNumber()).to.be.greaterThan(0)
        })

        it("does not let a WL claimant to claim with public", async () => {
            await formers.setIsPublicClaimActive(true)
            await formers.connect(userA).wlClaim(proof)
            await expect(formers.connect(userA).publicClaim()).to.be.revertedWith("E-003-005")
        })
    })

    describe("upon setting and returning base uri", () => {
        let id: BigNumber
        beforeEach(async function () {
            await formers.setListMerkleRoot(tree.getRoot())
            await formers.setIsCommunityClaimActive(true)
            let proof = tree.getHexProof(leaves[0])
            await formers.connect(userA).wlClaim(proof)
            id = await formers.tokenOfOwnerByIndex(userA.address,0)
        })
    
        it("allows the owner to change the base URI", async () => {
          await formers.setBaseURI("testString")
          let expectedURI = "testString" + String(id)
          let returnedURI = await formers.tokenURI(id)
          expect(returnedURI).to.equal(expectedURI)
        })
    
        it("does not allow a non-owner to change the base URI", async () => {
          await expect(formers.connect(userA).setBaseURI("testString")).to.be.reverted
        })
    })

    describe("upon setting provenance", async () => {
        let id: BigNumber
        let cod: string
        beforeEach(async function () {
            await formers.setIsPublicClaimActive(true)
            await formers.connect(userA).publicClaim()
            id = await formers.tokenOfOwnerByIndex(userA.address, 0) 
            cod = ethers.utils.formatBytes32String("anvil fell on head")
        })

        it("allows a token owner to set the provenance hash", async () => {
            let cod = ethers.utils.formatBytes32String("anvil fell on head")
            await formers.connect(userA).setProvenance(id,cod)
            let chainCod = await formers.getProvenanceById(id)
            expect(chainCod).to.equal(cod)
        })

        it("does not allow a non token owner to set the provenance hash", async () => {
            await expect(formers.connect(userB).setProvenance(id,cod)).to.be.revertedWith("E-003-007")
        })
    })
})