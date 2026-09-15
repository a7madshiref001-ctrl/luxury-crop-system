const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/ui",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5152",
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:5152/api/menu",
    reuseExistingServer: false,
    env: {
      PORT: "5152",
      DATA_DIR: `.runtime/ui-tests-${Date.now()}`,
      ADMIN_PASSWORD: "ui-test-password-local-only",
      NODE_ENV: "test",
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1050 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
