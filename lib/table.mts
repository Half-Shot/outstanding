import chalk from "chalk";
import TtyTable from "tty-table";
import type { PullRequest } from "./requests.mts";

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

function formatBlockedBy(blockedBy: PullRequest["blockedBy"]) {
  switch (blockedBy) {
    case "DRAFT":
      return chalk.italic.grey("Draft");
    case "BEHIND":
    case "DIRTY":
      return chalk.yellow("Update Req.");
    case "BLOCKED":
      return chalk.red("Review Req / Test Fail");
    case "CLEAN":
      return chalk.bold.green("Ready!");
    case "UNSTABLE":
      return chalk.bold.red("Test Fail");
    default:
      return blockedBy;
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

export function renderTable(
  sortedByRepo: Map<string, Set<PullRequest>>,
  skippedCount: number,
) {
  const data = [...sortedByRepo.values()].flatMap((s) => [...s.values()]);
  return TtyTable(
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
        value: "blockedBy",
        formatter: formatBlockedBy,
      },
      {
        value: "title",
        align: "left",
        formatter: (title) =>
          title.length > 40 ? title.slice(0, 40) + "..." : title,
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
}
