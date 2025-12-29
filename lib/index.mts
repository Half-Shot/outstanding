import { graphql } from "@octokit/graphql";
import {
  getInitialInfo,
  getOutstandingPRsForOrgs,
  type PullRequest,
} from "./requests.mts";
import ora from "ora";
import { createInterface } from "node:readline/promises";
import { getGitHubToken } from "./config.mts";
import { renderTable } from "./table.mts";

export async function main() {
  const githubToken = await getGitHubToken();
  const [_, __, includedOrgsStr, ignoreReposStr] = process.argv;
  if (includedOrgsStr === "--help" || includedOrgsStr === "-h") {
    // User is asking for help, so let's help!
    console.log(
      `Usage: outstanding [orgsToInclude] [reposToIgnore]

List all your GitHub PRs that are currently open.
The tool will prompt you to provide a GitHub PAT if you have not used the tool before.

Example:
    outstanding half-shot,matrix-org half-shot/outstanding
`,
    );
    return;
  }
  const includedOrgs = includedOrgsStr?.toLowerCase().split(",") ?? [];
  const ignoreRepos = ignoreReposStr?.toLowerCase().split(",") ?? [];

  const spinner = ora();

  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${githubToken}`,
    },
  });
  let rerun = false;
  do {
    try {
      spinner.info("Loading initial info from GitHub");
      const initialInfo = await getInitialInfo(graphqlWithAuth);
      spinner.start(
        `Loaded 0/${initialInfo.totalCount} PRs for ${initialInfo.username} (${initialInfo.name})`,
      );
      const sortedByRepo = new Map<string, Set<PullRequest>>();
      let skippedCount = 0;
      let foundCount = 0;
      for await (const element of getOutstandingPRsForOrgs(graphqlWithAuth)) {
        foundCount++;
        spinner.start(
          `Loaded ${foundCount}/${initialInfo.totalCount} PRs for ${initialInfo.username} (${initialInfo.name})`,
        );
        if (includedOrgs.length && !includedOrgs.includes(element.org)) {
          skippedCount++;
          continue;
        }
        if (ignoreRepos.includes(`${element.org}/${element.repository}`)) {
          skippedCount++;
          continue;
        }
        let prSet = sortedByRepo.get(element.repository);
        if (!prSet) {
          prSet = new Set();
          sortedByRepo.set(element.repository, prSet);
        }
        prSet.add(element);
      }
      spinner.succeed("Found all PRs!");
      console.log(renderTable(sortedByRepo, skippedCount));
    } catch (ex) {
      spinner.fail("Failed to run");
      throw ex;
    }

    const rl = createInterface({
      output: process.stdout,
      input: process.stdin,
    });
    const response = (await rl.question("Run again? (Y/N)")) || "y";
    rerun = response[0].toLocaleLowerCase() === "y";
    rl.close();
  } while (rerun);
}

// Types are missing
if (import.meta.main === true) {
  main().catch((ex) => {
    console.log("Fatal error", ex);
  });
}
