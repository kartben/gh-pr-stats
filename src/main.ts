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
        console.log(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    }
  },
});

let knownAuthors = new Set();

async function listPRs() {
  try {
    const csvFile = "prs.csv";
    const header = "PR number,PR title,open,close,status,days_to_close,author,isFirstMergedPR\n";
    fs.writeFileSync(csvFile, header);

    const csvFilePRLabels = "pr_labels.csv";
    const headerPRLabels = "PR number,label\n";
    fs.writeFileSync(csvFilePRLabels, headerPRLabels);

    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const prsResponse = await octokit.pulls.list({
        owner,
        repo,
        state: "all",
        per_page: 100,
        sort: "created",
        direction: "asc",
        page: currentPage,
      });

      const prs = prsResponse.data;

      if (prs.length === 0) {
        hasNextPage = false;
      } else {
        for (const pr of prs) {
          const author = pr.user?.login;

          let isFirstPR = false;
          if (author && pr.merged_at && !knownAuthors.has(author)) {
              knownAuthors.add(author);
              isFirstPR = true;

              // const query = `repo:${owner}/${repo} is:pr is:merged author:${author} closed:<=${pr.closed_at}`;
              // try {
              //   const { status: searchStatus, data: searchResults } = await octokit.rest.search.issuesAndPullRequests({ q: query });
              //   if (searchResults.total_count === 1) {
              //     console.log(`First merged PR for ${author}: ${pr.number}`);
              //       // add author to list so that we don't search again
              //       knownAuthors.add(author);
              //       isFirstPR = true;
              //   }
              // }
              // catch (error) {
              //   // ignore errors (usually it's a user that doesn't exist anymore)
              // }
          }
  
          const createdAt = new Date(pr.created_at).toISOString();
          const closedAt = pr.closed_at
            ? new Date(pr.closed_at).toISOString()
            : null;
          const duration = pr.closed_at
            ? moment(pr.closed_at).diff(moment(pr.created_at), "days", true)
            : null;
          const status = pr.merged_at ? "Merged" : pr.closed_at ? "Closed" : "Open";

          if (pr.labels.length > 0) {
            for (const label of pr.labels) {
              const csvRow = `${pr.number},${label.name}\n`;
              fs.appendFileSync(csvFilePRLabels, csvRow);
            }
          }

          pr.title = pr.title.replace(/"/g, '""');
          const csvRow = `${pr.number},"${pr.title}",${createdAt},${closedAt},${status},${duration},${author},${isFirstPR}\n`;
          //process.stdout.write(csvRow);
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
