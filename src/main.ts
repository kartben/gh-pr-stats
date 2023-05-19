import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";

import moment from "moment";
import fs, { writeFileSync } from "fs";

const owner = "zephyrproject-rtos";
const repo = "zephyr";

// get GitHub API token from environment variable
const GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN;

const MyOctokit = Octokit.plugin(throttling, retry);
const octokit = new MyOctokit({
  auth: GITHUB_API_TOKEN,
  throttle: {
    onSecondaryRateLimit: (retryAfter, options) => {
      return true;
    },
    onRateLimit: (retryAfter, options, octokit, retryCount) => {
      if (retryCount < 5) {
        return true;
      }
    }
  },
});

async function listPRs() {
  try {
    const csvFile = "prs.csv";
    const header = "PR number,open,close,status,days_to_close,labels\n";
    fs.writeFileSync(csvFile, header);

    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const prsResponse = await octokit.pulls.list({
        owner,
        repo,
        state: "all",
        per_page: 100,
        page: currentPage,
      });

      const prs = prsResponse.data;

//      console.log(await octokit.rateLimit.get());

      if (prs.length === 0) {
        hasNextPage = false;
      } else {
        for (const pr of prs) {
          const createdAt = new Date(pr.created_at).toISOString();
          const closedAt = pr.closed_at
            ? new Date(pr.closed_at).toISOString()
            : null;
            const duration = pr.closed_at
            ? moment(pr.closed_at).diff(moment(pr.created_at), "days", true)
            : null;
          const status = pr.merged_at ? "Merged" : pr.closed_at ? "Closed" : "Open";
          const labels = pr.labels.map((label) => label.name).join("###");

            const csvRow = `${pr.number},${createdAt},${closedAt},${status},${duration},${labels}\n`;
            process.stdout.write(csvRow);
            fs.appendFileSync(csvFile, csvRow);
          }

        currentPage += 1;
      }
    }
  } catch (error) {
    console.error("Error fetching PRs:", error);
  }
}

listPRs();
