import keytar from "keytar-forked-forked";
import { createInterface } from "node:readline/promises";
import { getInitialInfo } from "./requests.mts";
import { graphql } from "@octokit/graphql";

export async function getGitHubToken(): Promise<string> {
  const existing = await keytar.getPassword("outstanding.gh-token", "default");
  if (existing) {
    return existing;
  }
  console.log(
    "Hello! You seem to be a new user, please generate a GitHub token via https://github.com/settings/tokens/new.",
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let newToken = await rl.question("Enter your token here> ");
  // Try the new token
  while (true) {
    try {
      const { username } = await getInitialInfo(
        graphql.defaults({ headers: { authorization: `token ${newToken}` } }),
      );
      rl.close();
      console.log(`Authenticated as ${username}`);
      try {
        await keytar.setPassword("outstanding.gh-token", "default", newToken);
      } catch (ex) {
        console.warn("Failed to store password", ex);
      }
      break;
    } catch (ex) {
      newToken = await rl.question("Could not authenticate, try again?> ");
    }
  }
  return newToken;
}
