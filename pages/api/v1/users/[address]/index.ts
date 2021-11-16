import type { NextApiRequest, NextApiResponse } from "next"
import { getNonceRecord, putUserRecord } from "utils/db"
import { provider } from "utils/ethers"
import { utils } from "ethers"
export default async function postUsers(
    {
        query: { address },
        body: { name, avatar, link },
        headers,
        method,
    }: NextApiRequest,
    res: NextApiResponse<{}>
) {
    const token = new Headers(headers).get("CoinOneToken")
    if (!token) {
        return res.status(401).json({})
    }
    if (method !== "PUT") {
        return res.status(401).json({
            error: "Method not allowed",
        })
    }
    const record = await getNonceRecord(String(address))
    const signingAddress = utils
        .verifyMessage(record.nonce, token)
        .toLowerCase()

    if (signingAddress !== String(record.address).toLowerCase()) {
        return res.status(401).json({
            error: "invalid token",
        })
    }

    const resp = await putUserRecord({
        address: signingAddress,
        name,
        avatar,
        link,
    })
    console.log(resp)
    return res.status(200).json({})
}
