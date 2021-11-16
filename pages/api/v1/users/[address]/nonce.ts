import type { NextApiRequest, NextApiResponse } from "next"
import { createNonceRecord } from "utils/db"
export default async function getNonce(
    { method, query: { address } }: NextApiRequest,
    res: NextApiResponse<{}>
) {
    if (method !== "GET") {
        return res.status(405).send("Method not allowed")
    }

    const nonce = await createNonceRecord(address)

    return res.status(200).json({
        nonce,
    })
}
