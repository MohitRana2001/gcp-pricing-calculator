#!/usr/bin/env node

/**
 * VM Deployment Troubleshooting Script
 *
 * This script helps diagnose and fix common issues when deploying
 * Playwright-based automation in VM environments.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🔧 VM Deployment Troubleshooting Script");
console.log("=========================================\n");

// Check system information
function checkSystemInfo() {
  console.log("📊 System Information:");
  console.log(`- Node.js version: ${process.version}`);
  console.log(`- Platform: ${process.platform}`);
  console.log(`- Architecture: ${process.arch}`);
  console.log(
    `- Memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
  );
  console.log("");
}

// Check environment variables
function checkEnvironment() {
  console.log("🌍 Environment Variables:");
  const envVars = [
    "NODE_ENV",
    "DISPLAY",
    "CHROME_BIN",
    "PLAYWRIGHT_BROWSERS_PATH",
    "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD",
  ];

  envVars.forEach((envVar) => {
    const value = process.env[envVar];
    console.log(`- ${envVar}: ${value || "Not set"}`);
  });
  console.log("");
}

// Check if Playwright browsers are installed
function checkPlaywrightInstallation() {
  console.log("🎭 Playwright Installation Check:");

  try {
    const result = execSync("npx playwright --version", { encoding: "utf8" });
    console.log(`✅ Playwright version: ${result.trim()}`);
  } catch (error) {
    console.log("❌ Playwright not found or not working");
    return false;
  }

  // Check if browsers are installed
  try {
    execSync("npx playwright install --dry-run", { encoding: "utf8" });
    console.log("✅ Playwright browsers appear to be installed");
  } catch (error) {
    console.log("❌ Playwright browsers may not be installed");
    console.log(
      "💡 Try running: npx playwright install-deps && npx playwright install chromium"
    );
    return false;
  }

  console.log("");
  return true;
}

// Check system dependencies
function checkSystemDependencies() {
  console.log("📦 System Dependencies Check:");

  const dependencies = [
    "which chromium-browser",
    "which google-chrome",
    "which chrome",
    "which xvfb-run",
  ];

  dependencies.forEach((cmd) => {
    try {
      const result = execSync(cmd, { encoding: "utf8", stdio: "pipe" });
      console.log(`✅ ${cmd}: ${result.trim()}`);
    } catch (error) {
      console.log(`❌ ${cmd}: Not found`);
    }
  });

  console.log("");
}

// Test browser launch
async function testBrowserLaunch() {
  console.log("🚀 Testing Browser Launch:");

  try {
    // Import dynamically to handle missing playwright
    const { chromium } = await import("playwright");

    const browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--disable-extensions",
      ],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www.google.com");
    const title = await page.title();

    await browser.close();

    console.log(`✅ Browser launch successful - Title: ${title}`);
    return true;
  } catch (error) {
    console.log(`❌ Browser launch failed: ${error.message}`);
    console.log("💡 Common fixes:");
    console.log(
      "  1. Install missing dependencies: sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libgconf-2-4"
    );
    console.log("  2. Install fonts: sudo apt-get install -y fonts-liberation");
    console.log("  3. Run as non-root user or add --no-sandbox flag");
    console.log("  4. Increase memory if running in containers");
    return false;
  }
}

// Generate diagnostic report
function generateDiagnosticReport() {
  const report = {
    timestamp: new Date().toISOString(),
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      memory: process.memoryUsage(),
    },
    environment: Object.fromEntries(
      [
        "NODE_ENV",
        "DISPLAY",
        "CHROME_BIN",
        "PLAYWRIGHT_BROWSERS_PATH",
        "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD",
      ].map((key) => [key, process.env[key] || null])
    ),
    network: {
      hostname: require("os").hostname(),
      networkInterfaces: require("os").networkInterfaces(),
    },
  };

  const reportPath = path.join(process.cwd(), "vm-diagnostic-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`📋 Diagnostic report saved to: ${reportPath}`);
  return reportPath;
}

// Main troubleshooting function
async function main() {
  checkSystemInfo();
  checkEnvironment();

  const playwrightOk = checkPlaywrightInstallation();
  checkSystemDependencies();

  if (playwrightOk) {
    await testBrowserLaunch();
  }

  generateDiagnosticReport();

  console.log("\n🎯 Troubleshooting Complete!");
  console.log("\nIf you're still experiencing issues:");
  console.log("1. Check the diagnostic report above");
  console.log("2. Ensure VM has sufficient memory (recommend 2GB+)");
  console.log("3. Install missing system dependencies");
  console.log("4. Consider using Docker with pre-installed dependencies");
  console.log("5. Check firewall/network connectivity for outbound HTTPS");
}

// Handle CLI execution
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Troubleshooting script failed:", error);
    process.exit(1);
  });
}

module.exports = { main };
