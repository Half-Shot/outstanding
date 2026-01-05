import { graphql } from "@octokit/graphql";
import { getPRState } from "./requests/getPRState.mts";

interface GetInitialInfoResponse {
  viewer: {
    name: string;
    login: string;
    pullRequests: {
      totalCount: number;
    };
  };
}

export async function getInitialInfo(
  gql: typeof graphql,
): Promise<{ name: string; username: string; totalCount: number }> {
  const response = await gql<GetInitialInfoResponse>(`
        query getInitialInfo {
            viewer {
                name,
                login,
                pullRequests(states: OPEN, first: 0) {
                    totalCount,
                },
            },
        }
    `);

  return {
    name: response.viewer.name,
    username: response.viewer.login,
    totalCount: response.viewer.pullRequests.totalCount,
  };
}

type CheckSuiteConclusion = "SUCCESS" | "FAILURE" | "NEUTRAL";

interface GetOutstandingPRsForOrgsResponse {
  viewer: {
    login: string;
    pullRequests: {
      pageInfo: {
        endCursor: string;
        hasNextPage: boolean;
      };
      nodes: {
        createdAt: string;
        title: string;
        url: string;
        number: number;
        isDraft: boolean;
        assignees: {
          nodes: {
            login: string;
          }[];
        };
        repository: {
          isArchived: boolean;
          name: string;
          owner: {
            login: string;
          };
        };
      }[];
    };
  };
}

export interface PullRequest {
  title: string;
  repository: string;
  url: string;
  createdAt: Date;
  org: string;
  state: string;
  blockedBy:
    | "DIRTY"
    | "UNKNOWN"
    | "BLOCKED"
    | "BEHIND"
    | "DRAFT"
    | "UNSTABLE"
    | "FAILING_TESTS"
    | "HAS_HOOKS"
    | "CLEAN";
}

export async function* getOutstandingPRsForOrgs(
  gql: typeof graphql,
): AsyncGenerator<PullRequest> {
  let cursor = "";
  const toProcess: {
    element: GetOutstandingPRsForOrgsResponse["viewer"]["pullRequests"]["nodes"][0];
    prState: ReturnType<typeof getPRState>;
  }[] = [];
  do {
    const response = await gql<GetOutstandingPRsForOrgsResponse>(
      `
            query getOutstandingPRsForOrgs($cursor: String!){
                viewer {
                    login,
                    pullRequests(states: OPEN, first: 10, after: $cursor, orderBy: { direction: DESC, field: UPDATED_AT } ) {
                        pageInfo {
                            endCursor,
                            hasNextPage
                        },
                        nodes {
                            createdAt,
                            title,
                            url,
                            number,
                            isDraft,
                            assignees(first: 10) {
                                nodes{
                                    login,
                                }
                            },
                            repository {
                                isArchived,
                                name,
                                owner {
                                    login
                                },
                            }
                        }
                    },
                },
            }
        `,
      {
        cursor,
      },
    );
    const { pullRequests, login: myLogin } = response.viewer;
    for (const element of pullRequests.nodes) {
      if (element.repository.isArchived) {
        continue;
      }
      if (
        element.assignees.nodes.length !== 0 &&
        !element.assignees.nodes.some((n) => n.login === myLogin)
      ) {
        // Reassigned away, ignore.
        continue;
      }

      if (element.isDraft) {
        yield {
          title: element.title,
          state: "DRAFT",
          url: element.url,
          repository: element.repository.name,
          createdAt: new Date(element.createdAt),
          org: element.repository.owner.login,
          blockedBy: "DRAFT",
        };
        continue;
      }

      toProcess.push({
        element,
        prState: getPRState(
          gql,
          element.repository.owner.login,
          element.repository.name,
          element.number,
        ),
      });
    }
    cursor = pullRequests.pageInfo.hasNextPage
      ? pullRequests.pageInfo.endCursor
      : "";
  } while (cursor);

  // Now await and process all the remaining ones.
  for (const { element, prState: prStatePromise } of toProcess) {
    const prState = await prStatePromise;
    // Get extra state if needed.
    const currentChecksState = (
      prState.commits.nodes[0]?.checkSuites?.nodes ?? []
    ).reduce<CheckSuiteConclusion>((prev, curr) => {
      if (curr.status !== "COMPLETED") {
        return prev;
      }
      if (prev === "FAILURE") {
        return "FAILURE";
      }
      if (curr.conclusion === "SUCCESS" || curr.conclusion === "FAILURE") {
        return curr.conclusion;
      }
      return "NEUTRAL";
    }, "NEUTRAL");

    let blockedBy: PullRequest["blockedBy"];

    if (element.isDraft) {
      blockedBy = "DRAFT";
    } else if (currentChecksState === "FAILURE") {
      blockedBy = "FAILING_TESTS";
    } else {
      blockedBy = prState.mergeStateStatus;
    }

    yield {
      title: element.title,
      state: element.isDraft ? "DRAFT" : prState.reviewDecision,
      url: element.url,
      repository: element.repository.name,
      createdAt: new Date(element.createdAt),
      org: element.repository.owner.login,
      blockedBy,
    };
  }
}
