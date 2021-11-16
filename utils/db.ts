import {
    PutItemCommand,
    GetItemCommand,
    UpdateItemCommand,
    BatchGetItemCommand,
    DynamoDBClient,
    ExecuteStatementCommand,
    ItemResponse,
    AttributeValue,
} from "@aws-sdk/client-dynamodb"
import { nanoid } from "nanoid"
export const client = new DynamoDBClient({
    region: "local",
    endpoint: "http://localhost:8000",
    credentials: {
        accessKeyId: "local",
        secretAccessKey: "local",
    },
})

interface UserRecord extends Obj {
    address: string
    name?: string
    avatar?: string
    link?: string
}

interface Obj {
    [key: string]: string | undefined
}

const convertItemToObj = (Item: ItemResponse["Item"]) => {
    let obj: Obj = {}
    if (!Item) return obj
    Object.entries(Item).forEach(([key, value]) => {
        obj[key] = Item[key].S
    })
    return obj
}

const convertObjToItem = (obj: Obj) => {
    let Item: ItemResponse["Item"] = {}
    Object.entries(obj).forEach(([key, value]) => {
        if (value) {
            Item[key] = {
                S: value,
            }
        }
    })
    return Item
}

export async function putUserRecord(userRecord: UserRecord) {
    let Item = convertObjToItem(userRecord)
    console.log(Item)
    const resp = await client.send(
        new PutItemCommand({
            TableName: "users",
            Item,
        })
    )
    console.log(resp)
}

export async function getUserRecords(addresses: string[]) {
    const RequestItems = {
        users: {
            Keys: addresses.map((address) => ({
                address: { S: address.toLowerCase() },
            })),
            ProjectionExpress: "address,name,link,avatar",
        },
    }
    const { Responses } = await client.send(
        new BatchGetItemCommand({
            RequestItems,
        })
    )
    return Responses.users.map((user) => convertItemToObj(user))
}

interface ShrineRecord {
    index: number
    creator: string
    image: string
    html: string
    links: string
}

export async function createShrineRecord({
    creator,
    image,
    html,
    links,
}: ShrineRecord) {
    await client.send(
        new PutItemCommand({
            TableName: "shrines",
            Item: {
                creator: {
                    S: creator,
                },
                image: {
                    S: image,
                },
                html: {
                    S: html,
                },
                links: {
                    S: links,
                },
            },
        })
    )
}

export async function getShrineRecord({
    creator,
    image,
    html,
    links,
}: ShrineRecord) {
    await client.send(
        new GetItemCommand({
            TableName: "shrines",
            Key: {
                // index: {
                //   N: index,
                // },
            },
            ProjectionExpression: "index",
        })
    )
}

interface NonceRecord {
    address: string
}

export async function createNonceRecord(address: string) {
    const expiration = new Date(
        Date.now() + 1000 * 60 * 5 // 5 minutes
    ).toISOString()
    const nonce = nanoid()
    const result = await client.send(
        new PutItemCommand({
            TableName: "nonces",
            Item: {
                address: {
                    S: address,
                },
                nonce: {
                    S: nonce,
                },
                expiration: {
                    S: expiration,
                },
            },
        })
    )
    return nonce
}

export async function getNonceRecord(address: string) {
    const resp = await client.send(
        new GetItemCommand({
            TableName: "nonces",
            Key: {
                address: {
                    S: address,
                },
            },
            ProjectionExpression: "nonce,address",
        })
    )
    console.log(resp)
    return convertItemToObj(resp.Item)
}
