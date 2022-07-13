import simpleGit, { gitP, SimpleGit, GitError, PushResult, CleanOptions, CommitResult } from 'simple-git';
import * as logger from "./logger"
import * as timeHelpers from "./timeHelpers"

export async function commitAndTagRelease(chainId: Number) {
    const git: SimpleGit = simpleGit().clean(CleanOptions.FORCE)

    logger.divider()
    logger.out("Committing and tagging as release...", logger.Level.Info)

    await git.add('.').catch(catchTask)

    await git.commit(
        'Autonomous commit for deploy at ' + 
        timeHelpers.getFullTimestamp() + 
        ' on ' + chainId.toString())
        .catch(catchTask)

    let newTag = await nextTag(git)
    logger.pad(5, "Tagged as: ", newTag)
    
    await git.raw(["tag", newTag]).catch(catchTask)

    await git.pushTags('origin').catch(catchTask)
  }

async function nextTag(git: SimpleGit) {
    let latestTag = (await git.tags()).latest
    if(latestTag) {
        let latestSplit = latestTag.split(".")
        let minorIncr: number = +latestSplit[1] + 1
        latestSplit[1] = minorIncr.toString()
        latestSplit[2] = "0"
        return latestSplit.join('.')
    }
    return ""
}

function catchTask (e: GitError) {
    logger.out(e, logger.Level.Error)
  }