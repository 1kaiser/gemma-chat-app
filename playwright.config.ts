import { defineConfig, devices } from '@playwright/test';

// Try to find Chrome Canary path
function getChromeCanaryPath(): string | null {
  const possiblePaths = [
    '/usr/bin/google-chrome-unstable',  // Linux Chrome Canary
    '/opt/google/chrome-unstable/chrome', // Alternative Linux path
    '/usr/bin/google-chrome-canary',    // Some distros use this name
    'C:\\Users\\' + (process.env.USERNAME || 'user') + '\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe', // Windows
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary', // macOS
  ];
  
  const fs = require('fs');
  for (const path of possiblePaths) {
    try {
      if (fs.existsSync(path)) {
        console.log(`✅ Found Chrome Canary at: ${path}`);
        return path;
      }
    } catch (e) {
      // Continue checking other paths
    }
  }
  
  console.log('⚠️ Chrome Canary not found, falling back to regular Chrome');
  return '/usr/bin/google-chrome'; // Fallback to regular Chrome
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chrome-canary-webgpu',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: getChromeCanaryPath(),
          args: [
            '--enable-unsafe-webgpu',
            '--enable-features=WebGPU',
            '--use-angle=vulkan',
            '--enable-webgpu-developer-features',
            '--disable-dawn-features=disallow_unsafe_apis',
            '--enable-dawn-features=allow_unsafe_apis',
            '--no-sandbox',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--flag-switches-begin',
            '--enable-unsafe-webgpu',
            '--flag-switches-end'
          ],
        },
        contextOptions: {
          ignoreHTTPSErrors: true,
        }
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3001,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});