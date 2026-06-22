const { defineConfig, devices } = require('@playwright/test');

const PORT = 8099;

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    fullyParallel: true,
    reporter: process.env.CI ? 'github' : 'list',
    use: { baseURL: 'http://localhost:' + PORT },
    webServer: {
        command: 'node scripts/serve.js',
        url: 'http://localhost:' + PORT + '/index.html',
        reuseExistingServer: !process.env.CI,
        env: { PORT: String(PORT) },
        timeout: 30000,
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
