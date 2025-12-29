import { graphql } from "@octokit/graphql";

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
        isDraft: boolean;
        mergeStateStatus:
          | "DIRTY"
          | "UNKNOWN"
          | "BLOCKED"
          | "BEHIND"
          | "DRAFT"
          | "UNSTABLE"
          | "HAS_HOOKS"
          | "CLEAN";
        reviews: {
          nodes: {
            state: string;
          }[];
        };
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
    | "HAS_HOOKS"
    | "CLEAN";
}

export async function* getOutstandingPRsForOrgs(
  gql: typeof graphql,
): AsyncGenerator<PullRequest> {
  let cursor = "";
  do {
    const response = await gql<GetOutstandingPRsForOrgsResponse>(
      `
            query getOutstandingPRsForOrgs($cursor: String!){
                viewer {
                    login,
                    pullRequests(states: OPEN, first: 100, after: $cursor, orderBy: { direction: DESC, field: UPDATED_AT } ) {
                        pageInfo {
                            endCursor,
                            hasNextPage
                        },
                        nodes {
                            createdAt,
                            title,
                            url,
                            isDraft,
                            mergeStateStatus,
                            reviews(first: 10) {
                                nodes {
                                    state
                                }
                            }
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
      yield {
        title: element.title,
        state: element.isDraft
          ? "DRAFT"
          : element.reviews.nodes.reduce<string>(
              (prev, curr) => (prev === "APPROVED" ? prev : curr.state),
              "none",
            ),
        url: element.url,
        repository: element.repository.name,
        createdAt: new Date(element.createdAt),
        org: element.repository.owner.login,
        blockedBy: element.isDraft ? "DRAFT" : element.mergeStateStatus,
      };
    }
    cursor = pullRequests.pageInfo.hasNextPage
      ? pullRequests.pageInfo.endCursor
      : "";
  } while (cursor);
}
