"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const plugin_throttling_1 = require("@octokit/plugin-throttling");
const plugin_retry_1 = require("@octokit/plugin-retry");
const moment_1 = __importDefault(require("moment"));
const fs_1 = __importDefault(require("fs"));
const owner = "zephyrproject-rtos";
const repo = "zephyr";
// get GitHub API token from environment variable
const GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN;
const MyOctokit = rest_1.Octokit.plugin(plugin_throttling_1.throttling, plugin_retry_1.retry);
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
let knownAuthors = new Set();
async function listPRs() {
    var _a;
    try {
        const csvFile = "prs.csv";
        const header = "PR number,PR title,open,close,status,days_to_close,author,isFirstMergedPR\n";
        fs_1.default.writeFileSync(csvFile, header);
        const csvFilePRLabels = "pr_labels.csv";
        const headerPRLabels = "PR number,label\n";
        fs_1.default.writeFileSync(csvFilePRLabels, headerPRLabels);
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
            }
            else {
                for (const pr of prs) {
                    const author = (_a = pr.user) === null || _a === void 0 ? void 0 : _a.login;
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
                        ? (0, moment_1.default)(pr.closed_at).diff((0, moment_1.default)(pr.created_at), "days", true)
                        : null;
                    const status = pr.merged_at ? "Merged" : pr.closed_at ? "Closed" : "Open";
                    if (pr.labels.length > 0) {
                        for (const label of pr.labels) {
                            const csvRow = `${pr.number},${label.name}\n`;
                            fs_1.default.appendFileSync(csvFilePRLabels, csvRow);
                        }
                    }
                    pr.title = pr.title.replace(/"/g, '""');
                    const csvRow = `${pr.number},"${pr.title}",${createdAt},${closedAt},${status},${duration},${author},${isFirstPR}\n`;
                    //process.stdout.write(csvRow);
                    fs_1.default.appendFileSync(csvFile, csvRow);
                }
                currentPage += 1;
            }
        }
    }
    catch (error) {
        console.error("Error fetching PRs:", error);
    }
}
listPRs();
//# sourceMappingURL=main.js.map