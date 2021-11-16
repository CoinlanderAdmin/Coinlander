import { ethers } from "ethers";
import { CoinOne, CoinOneNFT } from "typechain";
import CoinOneJson from "../artifacts/contracts/CoinOne.sol/CoinOne.json";
import CoinOneNFTJson from "../artifacts/contracts/CoinOne.sol/CoinOneNFT.json";
// import { createAlchemyWeb3 } from "@alch/alchemy-web3"
// const alchemyUrl = "https://eth-mainnet.alchemyapi.io/v2/-BfUEF3G6d4HvE5-l570XzD4WvYA4a5Z"

const rpcUri = "http://localhost:8545";

export const rpcProvider = new ethers.providers.JsonRpcProvider(rpcUri);

export const getProvider = () => {
  if (window.etherium) {
    return new ethers.providers.Web3Provider(etherium);
  }
  return rpcProvider;
};

export const coinOneAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const coinOne = new ethers.Contract(
  coinOneAddress,
  CoinOneJson.abi,
  rpcProvider
) as CoinOne;

export async function getImmortalNFT(): Promise<CoinOneNFT> {
  const immortalNFTAddress = await coinOne.immortalNFT();

  return new ethers.Contract(
    immortalNFTAddress,
    CoinOneNFTJson.abi,
    rpcProvider
  ) as CoinOneNFT;
}

export async function addressBelongsToHolder(address: string) {
  const holder = await coinOne.holder();

  if (address === holder) {
    return true;
  }
  return false;
}

export async function addressBelongsToImmortal(address: string) {
  const immortalNFT = await getImmortalNFT();
  const balance = await immortalNFT.balanceOf(address);

  return await balance.gt(0);
}
