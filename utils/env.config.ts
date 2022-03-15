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

const RinkArbyKey: string | undefined = process.env.ALCHEMY_RINKARBY_API
if (!RinkArbyKey) {
  throw new Error("Please set the alchemy RinkArby API key the .env file")
}

const RinkebyKey: string | undefined = process.env.ALCHEMY_RINKEBY_API
if (!RinkebyKey) {
  throw new Error("Please set the alchemy Rinkeby API key the .env file")
}

const ArbiscanAPIKey: string | undefined = process.env.ARBISCAN_API_KEY
if (!ArbiscanAPIKey) {
  throw new Error("Please add the Arbiscan API key to your .env file")
}
export var envConfig = {
    'owner': owner,
    'userA': userA, 
    'userB': userB, 
    'RinkArbyKey': RinkArbyKey,
    'RinkebyKey': RinkebyKey,
    'ArbiscanAPIKey': ArbiscanAPIKey
}