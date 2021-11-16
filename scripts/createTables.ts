import {
    UpdateTimeToLiveCommand,
    ListTablesCommand,
    CreateTableCommand,
    DeleteTableCommand,
} from "@aws-sdk/client-dynamodb"
import { client } from "../utils/db"
async function main() {
    const { TableNames = [] } = await client.send(new ListTablesCommand({}))

    for (const TableName of TableNames) {
        await client.send(new DeleteTableCommand({ TableName }))
    }
    await client.send(
        new CreateTableCommand({
            TableName: "nonces",
            KeySchema: [
                {
                    AttributeName: "address",
                    KeyType: "HASH",
                },
            ],
            AttributeDefinitions: [
                {
                    AttributeName: "address",
                    AttributeType: "S",
                },
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
            },
            StreamSpecification: {
                StreamEnabled: false,
            },
        })
    )

    await client.send(
        new UpdateTimeToLiveCommand({
            TableName: "nonces",
            TimeToLiveSpecification: {
                AttributeName: "expiration",
                Enabled: true,
            },
        })
    )

    await client.send(
        new CreateTableCommand({
            TableName: "users",
            KeySchema: [
                {
                    AttributeName: "address",
                    KeyType: "HASH",
                },
            ],
            AttributeDefinitions: [
                {
                    AttributeName: "address",
                    AttributeType: "S",
                },
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
            },
            StreamSpecification: {
                StreamEnabled: false,
            },
        })
    )
    await client.send(
        new CreateTableCommand({
            TableName: "shrines",
            KeySchema: [
                {
                    AttributeName: "index",
                    KeyType: "HASH",
                },
            ],
            AttributeDefinitions: [
                {
                    AttributeName: "index",
                    AttributeType: "N",
                },
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
            },
            StreamSpecification: {
                StreamEnabled: false,
            },
        })
    )
    console.log(await client.send(new ListTablesCommand({})))
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
