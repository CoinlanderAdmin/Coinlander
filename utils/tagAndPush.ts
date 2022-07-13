import * as git from "./gitHelpers"

let networkId: number = 421611
export async function tagAndPush() {
  await git.commitAndTagRelease(networkId)
}

tagAndPush()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })