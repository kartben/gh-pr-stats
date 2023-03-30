"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const moment_1 = __importDefault(require("moment"));
const fs_1 = __importDefault(require("fs"));
const owner = "zephyrproject-rtos";
const repo = "zephyr";
const personalAccessToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const octokit = new rest_1.Octokit({ auth: personalAccessToken });
async function listPRs() {
    try {
        const csvFile = "prs.csv";
        const header = "PR number,open,close,status,days_to_close\n";
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
                    const csvRow = `${pr.number},${createdAt},${closedAt},${status},${duration}\n`;
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