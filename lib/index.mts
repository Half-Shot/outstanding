import { graphql } from "@octokit/graphql";
import {
  getInitialInfo,
  getOutstandingPRsForOrgs,
  type PullRequest,
} from "./requests.mts";
import ora from "ora";
import TtyTable from "tty-table";
import { createInterface } from "node:readline/promises";
import chalk from "chalk";
import { getGitHubToken } from "./config.mts";

function formatState(state: string) {
  switch (state) {
    case "DRAFT":
      return chalk.italic.grey(state);
    case "APPROVED":
      return chalk.bold.green(state);
    case "CHANGES_REQUESTED":
      return chalk.red(state);
    case "COMMENTED":
      return chalk.gray("UNREVIEWED");
    case "none":
      return chalk.gray("UNREVIEWED");
    default:
      return state;
  }
}

const OneDay = 24 * 60 * 60 * 1000;

function formatCreatedAt(createdAt: Date) {
  const daysOutstanding = Math.ceil(
    (Date.now() - createdAt.getTime()) / OneDay,
  );
  if (daysOutstanding < 60) {
    return chalk.gray(`${daysOutstanding} days`);
  }
  if (daysOutstanding < 365) {
    return chalk.yellow(`${daysOutstanding} days`);
  }
  const years = Math.floor(daysOutstanding / 365);
  if (years > 1) {
    return chalk.red.bold(`> ${years} years`);
  }
  return chalk.red.bold(`> 1 year `);
}

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
      spinner.info(
        `Loading ${initialInfo.totalCount} PRs for ${initialInfo.username} (${initialInfo.name})`,
      );
      const sortedByRepo = new Map<string, Set<PullRequest>>();
      let skippedCount = 0;
      for await (const element of getOutstandingPRsForOrgs(graphqlWithAuth)) {
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
      const data = [...sortedByRepo.values()].flatMap((s) => [...s.values()]);
      const out = TtyTable(
        [
          {
            value: "repository",
            align: "left",
          },
          {
            value: "createdAt",
            formatter: formatCreatedAt,
          },
          {
            value: "state",
            formatter: formatState,
          },
          {
            value: "title",
            align: "left",
          },
          {
            value: "url",
            align: "left",
          },
        ],
        data,
        [
          "TOTAL",
          function () {
            return chalk.italic(`${data.length}`);
          },
          "SKIPPED",
          function () {
            return chalk.italic(`${skippedCount}`);
          },
        ],
      ).render();
      console.log(out);
    } catch (ex) {
      spinner.fail("Failed to run");
      throw ex;
    }

    const rl = createInterface({
      output: process.stdout,
      input: process.stdin,
    });
    const response = await rl.question("Run again? (Y/N)");
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
