import { graphql } from "@octokit/graphql";

interface GetPRStateResponse {
  commits: {
    nodes: [
      {
        checkSuites: {
          nodes: {
            status:
              | "REQUESTED"
              | "QUEUED"
              | "IN_PROGRESS"
              | "COMPLETED"
              | "WAITING"
              | "PENDING";
            conclusion: string; // Other reasons
          }[];
        };
      },
    ];
  };
  mergeStateStatus:
    | "DIRTY"
    | "UNKNOWN"
    | "BLOCKED"
    | "BEHIND"
    | "DRAFT"
    | "UNSTABLE"
    | "HAS_HOOKS"
    | "CLEAN";
  reviewDecision: "APPROVED" | "COMMENTED" | "CHANGES_REQUESTED";
}

export async function getPRState(
  gql: typeof graphql,
  owner: string,
  name: string,
  prNumber: number,
): Promise<GetPRStateResponse> {
  const res = await gql<{ repository: { pullRequest: GetPRStateResponse } }>(
    `
    query getPRState($owner: String!, $name: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      mergeStateStatus
      reviewDecision
      commits(last: 1) {
        nodes {
          commit {
            checkSuites(first: 10) {
              nodes {
                conclusion
              }
            }
          }
        }
      }
    }
  }
}
`,
    {
      owner,
      name,
      prNumber,
    },
  );
  return res.repository.pullRequest;
}
