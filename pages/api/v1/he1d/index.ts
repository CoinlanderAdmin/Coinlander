import type { NextApiRequest, NextApiResponse } from "next"
import { ethers } from "ethers"
import { getImmortalNFT } from "utils/ethers"
export default async ({ method }: NextApiRequest, res: NextApiResponse<{}>) => {
    if (method !== "GET") {
        return res.status(405).send("Method not allowed")
    }

    const he1d = await getImmortalNFT()

    const accounts = await he1d.allTokenOwners()
    console.log(accounts)
    res.status(200).json(accounts)
}
