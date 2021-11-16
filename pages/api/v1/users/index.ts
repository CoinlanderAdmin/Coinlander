import type { NextApiRequest, NextApiResponse } from "next"
import { getUserRecords } from "utils/db"
import { coinOne, getImmortalNFT, rpcProvider } from "utils/ethers"

export default async function getAllImmortals(
    { method }: NextApiRequest,
    res: NextApiResponse<{}>
) {
    if (method !== "GET") {
        return res.status(405).send("Method not allowed")
    }
    const nft = await getImmortalNFT()
    const immortalAddresses = (await nft.allTokenOwners()).map((a) =>
        a.toLowerCase()
    )

    const immortalUsers = await getUserRecords(immortalAddresses)

    return res.status(200).json(
        immortalAddresses.map((address) => {
            let user = { address }
            const foundUser = immortalUsers.find((u) => u.address === address)
            if (foundUser) {
                Object.assign(user, foundUser)
            }
            return user
        })
    )
}
