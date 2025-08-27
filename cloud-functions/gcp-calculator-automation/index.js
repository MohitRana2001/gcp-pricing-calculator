const functions = require("@google-cloud/functions-framework");
const { chromium } = require("playwright");

// ---------- Utility functions ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffs = [300, 800, 1500];

function ciContains(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

async function clickWithRetry(target, nameForError) {
  let lastErr;
  for (let i = 0; i < backoffs.length; i++) {
    try {
      const locator = await target();
      await locator.scrollIntoViewIfNeeded();
      await locator.waitFor({ state: "visible", timeout: 5000 });
      await locator.click({ timeout: 5000, trial: false });
      return;
    } catch (err) {
      lastErr = err;
      await sleep(backoffs[i]);
    }
  }
  throw new Error(
    `Failed to click ${nameForError}: ${lastErr?.message || lastErr}`
  );
}

async function openCombobox(page, labelRe) {
  console.log(`🎯 COMBOBOX: Looking for combobox matching: ${labelRe}`);

  const combo = page.getByRole("combobox", { name: labelRe });
  const count = await combo.count();
  console.log(`📋 COMBOBOX: Found ${count} matching comboboxes`);

  if (count === 0) {
    throw new Error(`No combobox found matching: ${labelRe}`);
  }

  if (count > 1) {
    console.log(
      `⚠️ COMBOBOX: Multiple comboboxes found, using first visible one`
    );
  }

  const targetCombo = combo.first();
  await targetCombo.scrollIntoViewIfNeeded();
  await targetCombo.waitFor({ state: "visible" });

  try {
    const label =
      (await targetCombo.getAttribute("aria-label")) ||
      (await targetCombo.getAttribute("name")) ||
      "Unknown";
    console.log(`🎯 COMBOBOX: Clicking combobox with label: "${label}"`);
  } catch (e) {
    console.log(`🎯 COMBOBOX: Clicking combobox (could not read label)`);
  }

  await targetCombo.click();
  return targetCombo;
}

async function pickFromOpenList(page, desiredLabel) {
  console.log(`🔍 DROPDOWN: Looking for option "${desiredLabel}"`);

  const allLists = await page.locator('[role="listbox"], [role="menu"]').all();
  console.log(`📋 DROPDOWN: Found ${allLists.length} dropdown containers`);

  let targetList = null;
  for (const list of allLists) {
    try {
      const isVisible = await list.isVisible({ timeout: 1000 });
      if (isVisible) {
        const optionCount = await list
          .locator('[role="option"], [role="menuitem"], li')
          .count();
        console.log(
          `📋 DROPDOWN: List has ${optionCount} options and is visible`
        );
        if (optionCount > 0) {
          targetList = list;
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }

  if (!targetList) {
    throw new Error("No visible dropdown with options found");
  }

  console.log(`✅ DROPDOWN: Using target dropdown`);

  const options = targetList.locator('[role="option"], [role="menuitem"], li');
  const count = await options.count();
  console.log(`📝 DROPDOWN: Found ${count} options in target dropdown`);

  if (count === 0)
    throw new Error("No dropdown options visible in target dropdown");

  // Log available options for debugging
  for (let i = 0; i < Math.min(count, 10); i++) {
    try {
      const optText = await options.nth(i).innerText({ timeout: 1000 });
      console.log(`  ${i + 1}. "${optText.trim()}"`);
    } catch (e) {
      console.log(`  ${i + 1}. [Could not read text]`);
    }
  }

  // Try exact match first
  for (let i = 0; i < count; i++) {
    const op = options.nth(i);
    try {
      const txt = (await op.innerText({ timeout: 1000 })).trim();
      if (txt.toLowerCase() === desiredLabel.toLowerCase()) {
        console.log(`🎯 DROPDOWN: Found exact match: "${txt}"`);
        await op.click();
        return txt;
      }
    } catch (e) {
      continue;
    }
  }

  // Try contains match
  for (let i = 0; i < count; i++) {
    const op = options.nth(i);
    try {
      const txt = (await op.innerText({ timeout: 1000 })).trim();
      if (ciContains(txt, desiredLabel)) {
        console.log(
          `🎯 DROPDOWN: Found fuzzy match: "${txt}" for "${desiredLabel}"`
        );
        await op.click();
        return txt;
      }
    } catch (e) {
      continue;
    }
  }

  throw new Error(
    `Option not found in dropdown: "${desiredLabel}". Available options logged above.`
  );
}

async function selectComboboxOption(page, labelRe, desiredLabel) {
  console.log(
    `🎛️ SELECT: Starting selection for "${desiredLabel}" in combobox ${labelRe}`
  );

  const combo = await openCombobox(page, labelRe);
  await sleep(500);

  try {
    console.log(`⌨️ SELECT: Typing "${desiredLabel}" to filter options`);
    await page.keyboard.type(desiredLabel, { delay: 50 });
    await sleep(300);
  } catch (e) {
    console.log(
      `⌨️ SELECT: Typing not supported, proceeding with manual selection`
    );
  }

  const chosen = await pickFromOpenList(page, desiredLabel);
  await sleep(300);

  try {
    const text = await combo.innerText({ timeout: 3000 });
    const rx = new RegExp(chosen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (!rx.test(text)) {
      console.log(
        `⚠️ SELECT: Warning - Selection "${chosen}" not reflected in combobox text: "${text}"`
      );
    } else {
      console.log(`✅ SELECT: Selection "${chosen}" confirmed in combobox`);
    }
  } catch (e) {
    console.log(
      `⚠️ SELECT: Could not verify selection reflection: ${e.message}`
    );
  }

  console.log(`🎉 SELECT: Successfully selected "${chosen}"`);
  return chosen;
}

async function setAdvancedOff(page) {
  const candidates = [
    page.getByRole("switch", { name: /advanced settings/i }),
    page.getByRole("button", { name: /advanced settings/i }),
    page.getByLabel(/advanced settings/i),
  ];

  for (const cand of candidates) {
    if (await cand.count()) {
      try {
        await cand.scrollIntoViewIfNeeded();
        const el = cand.first();
        const ariaPressed = await el.getAttribute("aria-pressed");
        const ariaChecked = await el.getAttribute("aria-checked");
        const isOn = ariaPressed === "true" || ariaChecked === "true";
        if (isOn) {
          await el.click();
        }
        return;
      } catch {}
    }
  }
}

async function dismissOverlays(page) {
  const buttons = [/accept/i, /agree/i, /ok/i, /got it/i, /dismiss/i, /close/i];
  for (const re of buttons) {
    const btn = page.getByRole("button", { name: re });
    if (await btn.count()) {
      try {
        await btn.first().click({ timeout: 1000 });
        await sleep(200);
      } catch {}
    }
  }

  const cookieSelectors = [
    "#cookie",
    '[data-testid*="cookie"]',
    '[id*="cookie"]',
    '[class*="cookie"]',
  ];
  for (const sel of cookieSelectors) {
    const loc = page.locator(sel + " button");
    if (await loc.count()) {
      try {
        await loc.first().click({ timeout: 1000 });
      } catch {}
    }
  }
}

async function safeInnerText(loc, fallback = null) {
  try {
    return (await loc.innerText({ timeout: 1500 })).trim();
  } catch {
    return fallback;
  }
}

// Main automation function
async function runGcpCalculatorAutomation(estimateRequest) {
  console.log("🚀 Starting GCP Calculator automation in Cloud Function");
  console.log("📋 Request:", JSON.stringify(estimateRequest, null, 2));

  let browser = null;
  let context = null;
  let page = null;

  const result = {
    success: false,
    shareUrl: null,
    csvDownloadUrl: null,
    error: null,
    estimateSummary: null,
  };

  try {
    // Cloud Function optimized browser launch
    console.log("🔧 Launching browser with Cloud Function optimizations...");
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-ipc-flooding-protection",
        "--memory-pressure-off",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-background-mode",
        "--disable-hang-monitor",
      ],
      timeout: 30000,
    });

    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "en-US",
      ignoreHTTPSErrors: true,
      bypassCSP: true,
    });

    page = await context.newPage();
    page.setDefaultTimeout(estimateRequest.timeoutMs || 60000);

    const URL = "https://cloud.google.com/products/calculator?hl=en";
    console.log(`🌐 Navigating to GCP Calculator: ${URL}`);
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await dismissOverlays(page);

    // Click "Add to estimate"
    console.log(`🎯 Looking for 'Add to estimate' button...`);
    await clickWithRetry(
      () =>
        Promise.resolve(
          page.getByRole("button", { name: /add to estimate/i }).first()
        ),
      "Add to estimate"
    );

    // Pick service card
    console.log(`🎛️ Looking for service card: ${estimateRequest.service}`);
    await clickWithRetry(
      () =>
        Promise.resolve(
          page
            .getByRole("button", {
              name: new RegExp(estimateRequest.service, "i"),
            })
            .first()
        ),
      `Service card: ${estimateRequest.service}`
    );

    // Ensure service type = Instances
    console.log(`🔧 Setting service type to 'Instances'...`);
    const instancesToggle = page
      .getByRole("radio", { name: /instances/i })
      .or(page.getByRole("button", { name: /instances/i }));
    const instancesCount = await instancesToggle.count();

    if (instancesCount > 0) {
      await clickWithRetry(
        () => Promise.resolve(instancesToggle.first()),
        "Service type: Instances"
      );
    }

    await setAdvancedOff(page);
    console.log(`✅ Initial setup complete, starting form filling...`);

    // Process each instance
    for (let i = 0; i < estimateRequest.instances.length; i++) {
      const inst = estimateRequest.instances[i];
      console.log(
        `\n🔧 Filling instance ${i + 1}/${estimateRequest.instances.length}`
      );

      await fillInstanceForm(page, inst);

      // Re-ensure settings for next iteration
      await setAdvancedOff(page);
    }

    // Get total cost
    console.log("💰 Looking for total cost...");
    const totalLocatorCandidates = [
      page.getByText(/total.*\/\s*month/i),
      page.getByText(/^total/i),
      page.locator("text=/\\$[0-9,]+(\\.[0-9]{2})?\\s*\\/\\s*month/i"),
    ];

    let totalText = null;
    for (const cand of totalLocatorCandidates) {
      if (await cand.count()) {
        const t = await safeInnerText(cand.first(), null);
        if (t && /\$[0-9,]+(\.[0-9]{2})?/i.test(t)) {
          totalText = t;
          break;
        }
      }
    }

    if (!totalText) {
      const anyMoney = page.locator("text=/\\$[0-9,]+(\\.[0-9]{2})?/i").first();
      if (await anyMoney.count()) {
        totalText = await safeInnerText(anyMoney, null);
      }
    }

    if (!totalText)
      throw new Error("Total not found or not formatted as currency");

    // Share the estimate
    console.log(`🔗 Looking for Share button...`);
    const shareBtn = page
      .locator('button[aria-label="Open Share Estimate dialog"]')
      .first();
    const shareBtnCount = await shareBtn.count();

    if (shareBtnCount > 0) {
      await clickWithRetry(() => Promise.resolve(shareBtn), "Share button");
    } else {
      const fallbackShareBtn = page
        .getByRole("button", { name: /share/i })
        .first();
      await clickWithRetry(
        () => Promise.resolve(fallbackShareBtn),
        "Share button (fallback)"
      );
    }

    await sleep(2000);

    // Extract share URL
    console.log(`🔍 Looking for share URL...`);
    let shareUrl = null;

    const copyLink = page.getByRole("button", { name: /copy link/i }).first();
    const copyLinkCount = await copyLink.count();

    if (copyLinkCount > 0) {
      try {
        const candidateInput = copyLink.locator("xpath=..").locator("input");
        const candidateInputCount = await candidateInput.count();

        if (candidateInputCount > 0) {
          shareUrl = (await candidateInput.first().inputValue()).trim();
        } else {
          await copyLink.click({ timeout: 2000 });
          await sleep(1000);

          const shareInputAfterClick = page
            .locator('input[type="text"], input[readonly], input')
            .filter({ hasText: /https?:\/\//i })
            .first();
          if (await shareInputAfterClick.count()) {
            shareUrl = (await shareInputAfterClick.inputValue()).trim();
          }
        }
      } catch (e) {
        console.log(`⚠️ Error handling Copy link: ${e.message}`);
      }
    }

    // Fallback methods for share URL
    if (!shareUrl) {
      const shareTextbox = page
        .getByRole("textbox")
        .filter({ hasText: /https?:\/\//i })
        .first();
      if (await shareTextbox.count()) {
        try {
          shareUrl = (await shareTextbox.inputValue()).trim();
        } catch {}
      }
    }

    if (!shareUrl) {
      const anyLink = page
        .locator('a[href^="https://cloud.google.com/products/calculator"]')
        .first();
      if (await anyLink.count()) {
        shareUrl = (await anyLink.getAttribute("href")) || null;
      }
    }

    if (!shareUrl) {
      throw new Error("Failed to capture share URL from Share UI");
    }

    // Handle CSV link if requested
    let csvUrl = null;
    if (estimateRequest.wantCsvLink) {
      const csvButton = page
        .getByRole("button", { name: /download csv|csv/i })
        .first();
      const csvLink = page
        .locator("a", { hasText: /download csv|csv/i })
        .first();

      if (await csvLink.count()) {
        const href = await csvLink.getAttribute("href");
        if (href && /^https?:\/\//i.test(href)) csvUrl = href;
      }
    }

    result.success = true;
    result.shareUrl = shareUrl;
    result.csvDownloadUrl = csvUrl;
    result.estimateSummary = {
      totalText,
      lineItems: [], // Could be enhanced to extract line items
    };

    console.log(`✅ Successfully generated URL: ${shareUrl}`);
    return result;
  } catch (error) {
    console.error("❌ Automation error:", error);
    result.error = error.message;
    return result;
  } finally {
    try {
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (e) {
      console.log("⚠️ Cleanup error:", e);
    }
  }
}

async function fillInstanceForm(page, inst) {
  console.log(`📋 Configuration:`, {
    instances: inst.numberOfInstances,
    hours: inst.totalHours,
    os: inst.operatingSystem,
    provisioning: inst.provisioningModel,
    series: inst.series,
    machineType: inst.machineType,
    region: inst.region,
    commitment: inst.committedUse,
  });

  // Number of instances
  const numInput = page.getByLabel(/number of instances/i);
  await numInput.fill(String(inst.numberOfInstances));

  // Total hours
  const hoursInput = page
    .getByLabel(/total hours|hours per month|hrs per month/i)
    .first();
  if (await hoursInput.count()) {
    await hoursInput.fill(String(inst.totalHours));
  }

  // Operating system
  let osToSelect = inst.operatingSystem;
  if (inst.operatingSystem.toLowerCase() === "linux") {
    osToSelect = "Free: Debian, CentOS, CoreOS, Ubuntu or BYOL";
  } else if (inst.operatingSystem.toLowerCase() === "windows") {
    osToSelect = "Windows Server";
  }

  await selectComboboxOption(page, /operating system|os/i, osToSelect);

  // Provisioning model
  const provisioningPatterns = [
    /provisioning model/i,
    /instance type/i,
    /vm type/i,
    /compute type/i,
  ];

  let provisioningSelected = false;
  for (const pattern of provisioningPatterns) {
    try {
      const comboCount = await page
        .getByRole("combobox", { name: pattern })
        .count();
      if (comboCount > 0) {
        await selectComboboxOption(page, pattern, inst.provisioningModel);
        provisioningSelected = true;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!provisioningSelected) {
    // Try radio buttons
    const regularRadio = page.locator('input[type="radio"][value="regular"]');
    const spotRadio = page.locator('input[type="radio"][value="spot"]');

    const isSpot = inst.provisioningModel.toLowerCase().includes("spot");
    const targetRadio = isSpot ? spotRadio : regularRadio;

    if ((await targetRadio.count()) > 0) {
      const isChecked = await targetRadio.isChecked();
      if (!isChecked) {
        await targetRadio.click();
        await sleep(1500);
      }
    }
  }

  await sleep(2000); // Wait for form updates

  // Series
  try {
    const seriesDropdownButton = page
      .locator('[role="combobox"][aria-labelledby*="ucc-"]:has-text("Series")')
      .first();
    if ((await seriesDropdownButton.count()) > 0) {
      await seriesDropdownButton.click();
      await sleep(1000);

      const seriesLower = inst.series.toLowerCase();
      const seriesUpper = inst.series.toUpperCase();

      let seriesOption = page.locator(
        `[role="option"][data-value="${seriesLower}"]`
      );
      if ((await seriesOption.count()) === 0) {
        seriesOption = page.locator(
          `[role="option"][data-value="${seriesUpper}"]`
        );
      }

      if ((await seriesOption.count()) > 0) {
        await seriesOption.click();
        await sleep(1500);
      }
    }
  } catch (e) {
    throw new Error(
      `Could not select series: ${inst.series}. Error: ${e.message}`
    );
  }

  // Machine type
  try {
    const machineTypeDropdownButton = page
      .locator(
        '[role="combobox"][aria-labelledby*="ucc-"]:has-text("Machine type")'
      )
      .first();
    if ((await machineTypeDropdownButton.count()) > 0) {
      await machineTypeDropdownButton.click();
      await sleep(1000);

      const machineTypeOption = page.locator(
        `[role="option"][data-value="${inst.machineType}"]`
      );
      if ((await machineTypeOption.count()) > 0) {
        await machineTypeOption.click();
        await sleep(1500);
      }
    }
  } catch (e) {
    throw new Error(
      `Could not select machine type: ${inst.machineType}. Error: ${e.message}`
    );
  }

  // Region
  await selectComboboxOption(page, /region|location/i, inst.region);

  // Committed use
  const desired = inst.committedUse.toLowerCase();
  let commitmentLabel = "None";
  if (desired.startsWith("1")) {
    commitmentLabel = "Resource-based CUD - 1 Year";
  } else if (desired.startsWith("3")) {
    commitmentLabel = "Resource-based CUD - 3 Years";
  }

  const commitRadio = page.getByRole("radio", {
    name: commitmentLabel,
    exact: true,
  });
  if ((await commitRadio.count()) > 0) {
    await commitRadio.first().click();
  } else {
    try {
      await selectComboboxOption(
        page,
        /committed use|commitment/i,
        commitmentLabel
      );
    } catch (e) {
      console.log(`⚠️ Could not select commitment: ${commitmentLabel}`);
    }
  }
}

// Cloud Function entry point
functions.http("gcpCalculatorAutomation", async (req, res) => {
  // Set CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  console.log("🚀 Cloud Function invoked");
  console.log("📋 Request body:", JSON.stringify(req.body, null, 2));

  try {
    const estimateRequest = req.body;

    // Validate request
    if (
      !estimateRequest ||
      !estimateRequest.instances ||
      !Array.isArray(estimateRequest.instances)
    ) {
      throw new Error("Invalid request: instances array is required");
    }

    if (estimateRequest.instances.length === 0) {
      throw new Error("At least one instance configuration is required");
    }

    // Set defaults
    estimateRequest.service = estimateRequest.service || "Compute Engine";
    estimateRequest.timeoutMs = estimateRequest.timeoutMs || 60000;
    estimateRequest.wantCsvLink = estimateRequest.wantCsvLink || false;

    const result = await runGcpCalculatorAutomation(estimateRequest);

    console.log(
      "✅ Function completed:",
      result.success ? "Success" : "Failed"
    );
    res.json(result);
  } catch (error) {
    console.error("❌ Function error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: "Cloud Function execution failed",
    });
  }
});

// Export for local testing
module.exports = { gcpCalculatorAutomation: functions.http };
