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
async function listPRs() {
    try {
        const csvFile = "prs.csv";
        const header = "PR number,open,close,status,days_to_close,labels\n";
        fs_1.default.writeFileSync(csvFile, header);
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
            }
            else {
                for (const pr of prs) {
                    const createdAt = new Date(pr.created_at).toISOString();
                    const closedAt = pr.closed_at
                        ? new Date(pr.closed_at).toISOString()
                        : null;
                    const duration = pr.closed_at
                        ? (0, moment_1.default)(pr.closed_at).diff((0, moment_1.default)(pr.created_at), "days", true)
                        : null;
                    const status = pr.merged_at ? "Merged" : pr.closed_at ? "Closed" : "Open";
                    const labels = pr.labels.map((label) => label.name).join("###");
                    const csvRow = `${pr.number},${createdAt},${closedAt},${status},${duration},${labels}\n`;
                    process.stdout.write(csvRow);
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