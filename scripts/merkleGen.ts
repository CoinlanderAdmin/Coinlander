import { MerkleTree } from 'merkletreejs'
import {ethers} from "hardhat"
import * as fs from "fs"
const keccak256  = require('keccak256')
import * as logger from '../utils/logger'


async function generateAndUpdateMerkle() {
    logger.divider()
    logger.out('Generating and updating merkle root...', logger.Level.Info)
    logger.divider()

    const network = await ethers.provider.getNetwork()
    
    const wlFilename = 'data/dev_whitelist.json'
    const addrFilename = 'addresses.json'

    logger.out('Reading whitelist addresses from ' + wlFilename, logger.Level.Info)
    const wlFile = fs.readFileSync(wlFilename , 'utf8');
    const wlJson = JSON.parse(wlFile);
    const wl = wlJson["whitelist"]
    logger.out(wl)
    logger.divider()

    logger.out('Reading contract addresses from ' + addrFilename, logger.Level.Info)
    const addressesJson = fs.readFileSync(addrFilename, 'utf8');
    const deployData = JSON.parse(addressesJson);
    const addresses = deployData[network.chainId]["0"]
    logger.out(addresses)
    logger.divider()

    logger.out('Generating merkle tree')
    const leaves = wl.map(keccak256)
    const tree = new MerkleTree(leaves, keccak256)
    const root = tree.getRoot()
    wlJson.root = "0x" + root.toString('hex')
    logger.out(tree.toString())
    logger.divider()

    logger.out('Attaching to contract for update')
    const Citizens = await ethers.getContractFactory("Citizens")
    const citizens = await Citizens.attach(addresses.contracts.citizens)
    await citizens.setListMerkleRoot(root)
    let newMerkleRoot = await citizens.WLMerkleRoot()
    logger.pad(20, 'New merkle root set to ', newMerkleRoot) 
    logger.divider()

    logger.out('Generating proofs for each recipient')
    for(let i = 0; i < leaves.length; i++) {
      let proof = tree.getHexProof(leaves[i])
      wlJson.proofs[wl[i]] = proof
    }
    logger.out('Writing data to ' + wlFilename)
    let data = JSON.stringify(wlJson, null, 2)
    fs.writeFileSync(wlFilename, data, "utf8")
}

generateAndUpdateMerkle()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
