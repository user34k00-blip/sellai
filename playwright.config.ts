import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"./tests/e2e",timeout:30000,fullyParallel:true,use:{baseURL:process.env.E2E_BASE_URL||"http://localhost:3000",browserName:"chromium",channel:process.env.PLAYWRIGHT_CHANNEL,screenshot:"only-on-failure",trace:"retain-on-failure"},reporter:"list"});
