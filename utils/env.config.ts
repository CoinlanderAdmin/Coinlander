// Env handling: 
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "../.env") });

const owner: string | undefined = process.env.OWNER_KEY;
if (!owner) {
  throw new Error("Please set your OWNER_KEY in a .env file");
}

const userA: string | undefined = process.env.USERA_KEY;
if (!userA) {
  throw new Error("Please set your USERA_KEY in a .env file");
}

const userB: string | undefined = process.env.USERB_KEY;
if (!userB) {
  throw new Error("Please set your USERB_KEY in a .env file");
}

const deployer: string | undefined = process.env.DEPLOYER_KEY;
if (!deployer) {
  throw new Error("Please set your DEPLOYER_KEY in a .env file");
}

const ArbitrumRPC: string | undefined = process.env.ARBITRUM_RPC;
if (!ArbitrumRPC) {
  throw new Error("Please set your ARBITRUM_RPC in a .env file");
}

const GoArbyRPC: string | undefined = process.env.GOARBY_RPC
if (!GoArbyRPC) {
  throw new Error("Please set the alchemy GoArby RPC url the .env file")
}

const ArbiscanAPIKey: string | undefined = process.env.ARBISCAN_API_KEY
if (!ArbiscanAPIKey) {
  throw new Error("Please add the Arbiscan API key to your .env file")
}

const MultiSigAddr: string | undefined = process.env.MULTISIG_ADDR
if (!MultiSigAddr) {
  throw new Error("Please add the Multisig Address to your .env file")
}

const OracleAddr: string | undefined = process.env.ORACLE_ADDR
if (!OracleAddr) {
  throw new Error("Please add the Oracle Address to your .env file")
}

export var envConfig = {
    'owner': owner,
    'userA': userA, 
    'userB': userB, 
    'deployer': deployer,
    'ArbitrumRPC': ArbitrumRPC,
    'GoArbyRPC': GoArbyRPC,
    'ArbiscanAPIKey': ArbiscanAPIKey,
    'MultiSigAddr': MultiSigAddr,
    'OracleAddr': OracleAddr
}