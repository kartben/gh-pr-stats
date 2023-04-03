import { Octokit } from "@octokit/rest";
import moment from "moment";
import fs, { writeFileSync } from "fs";

const owner = "zephyrproject-rtos";
const repo = "zephyr";
const personalAccessToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

const octokit = new Octokit({ auth: personalAccessToken });

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
