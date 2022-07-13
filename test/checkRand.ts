import {ethers} from "hardhat"
import * as fs from "fs";
import * as logger from "../utils/logger"
import { time } from "console";

export async function checkRand() {

    let CR = await ethers.getContractFactory("CheckRand")
    let cr = await CR.deploy() 
    console.log(cr.address)

    let allData: any = {}
    for(let i =0; i< 200; i++) {
      try { 
        // console.log(await ethers.provider.getBlockNumber()) 
        // console.log(await cr._returnTime())
        let r = Math.floor(Math.random() * 11111) + 1;
        console.log(r)
        // await cr.changeState(r)
        let n1 = (await cr._getRandomNumber(20,r)).toNumber()
        console.log(n1)
        let n2 = (await cr._getRandomNumber(20,r+1)).toNumber()
        console.log(n2)
        let n3 = (await cr._getRandomNumber(20,r+2)).toNumber()
        console.log(n3)
        let n4 = (await cr._getRandomNumber(20,r+3)).toNumber()
        console.log(n4)
        logger.divider()
        let singleData = {
          'aps' : [n1,n2,n3,n4]
        }
        allData[i] = singleData

        await delay(1000)
      }
      catch {}
    }
  var json = JSON.stringify(allData);
  var fs = require('fs');
  fs.writeFileSync('local/data/dist.json', json, 'utf8');
  logger.divider()
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

checkRand()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
