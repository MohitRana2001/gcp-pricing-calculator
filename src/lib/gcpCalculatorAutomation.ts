// Advanced GCP Pricing Calculator URL Generator using Playwright automation
// This script automates the official Google Cloud Pricing Calculator to generate shareable URLs

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export type InstanceInput = {
  numberOfInstances: number;
  totalHours: number;
  operatingSystem: string;
  provisioningModel: string; // Regular | Spot/Preemptible (includes fuzzy)
  series: string;            // e.g., E2, N2
  machineType: string;       // e.g., e2-standard-4
  region: string;            // e.g., Iowa (us-central1)
  committedUse: 'none' | '1 year' | '3 years';
};

export type EstimateRequest = {
  headless?: boolean;
  timeoutMs?: number;
  service: string; // e.g., 'Compute Engine'
  instances: InstanceInput[];
  wantCsvLink?: boolean;
  collectArtifacts?: boolean; // if true, write screenshots/HAR/logs to disk
};

export type OutputJSON = {
  success: boolean;
  shareUrl?: string;
  csvDownloadUrl?: string | null;
  estimateSummary?: {
    lineItems: Array<{
      service: string;
      region: string;
      series: string;
      machineType: string;
      instances: number;
      totalHours: number;
      committedUse: string;
      os: string;
      subtotalText: string | null;
    }>;
    totalText: string | null;
  };
  artifacts?: {
    screenshots?: {
      estimatePanel?: string;
      shareMenu?: string;
      lastError?: string;
    };
    consoleLogs?: string;
    networkLogs?: string;
  };
  error?: string;
};

const URL = 'https://cloud.google.com/products/calculator?hl=en'; // keep hl=en for stable labels

// ---------- Utility functions ----------
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const backoffs = [300, 800, 1500];

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function ciContains(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

async function clickWithRetry(target: () => Promise<import('playwright').Locator>, nameForError: string) {
  let lastErr: any;
  for (let i = 0; i < backoffs.length; i++) {
    try {
      const locator = await target();
      await locator.scrollIntoViewIfNeeded();
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.click({ timeout: 5000, trial: false });
      return;
    } catch (err) {
      lastErr = err;
      await sleep(backoffs[i]);
    }
  }
  throw new Error(`Failed to click ${nameForError}: ${lastErr?.message || lastErr}`);
}

async function openCombobox(page: Page, labelRe: RegExp) {
  console.log(`🎯 COMBOBOX: Looking for combobox matching: ${labelRe}`);

  const combo = page.getByRole('combobox', { name: labelRe });
  const count = await combo.count();
  console.log(`📋 COMBOBOX: Found ${count} matching comboboxes`);

  if (count === 0) {
    throw new Error(`No combobox found matching: ${labelRe}`);
  }

  if (count > 1) {
    console.log(`⚠️ COMBOBOX: Multiple comboboxes found, using first visible one`);
  }

  // Use the first visible combobox
  const targetCombo = combo.first();
  await targetCombo.scrollIntoViewIfNeeded();
  await targetCombo.waitFor({ state: 'visible' });

  // Log the combobox label for debugging
  try {
    const label = await targetCombo.getAttribute('aria-label') || await targetCombo.getAttribute('name') || 'Unknown';
    console.log(`🎯 COMBOBOX: Clicking combobox with label: "${label}"`);
  } catch (e) {
    console.log(`🎯 COMBOBOX: Clicking combobox (could not read label)`);
  }

  await targetCombo.click();
  return targetCombo;
}

async function pickFromOpenList(page: Page, desiredLabel: string) {
  console.log(`🔍 DROPDOWN: Looking for option "${desiredLabel}"`);

  // Find all visible dropdown containers
  const allLists = await page.locator('[role="listbox"], [role="menu"]').all();
  console.log(`📋 DROPDOWN: Found ${allLists.length} dropdown containers`);

  // Find the most recently opened/visible dropdown
  let targetList = null;
  for (const list of allLists) {
    try {
      const isVisible = await list.isVisible({ timeout: 1000 });
      if (isVisible) {
        // Check if this dropdown actually contains options
        const optionCount = await list.locator('[role="option"], [role="menuitem"], li').count();
        console.log(`📋 DROPDOWN: List has ${optionCount} options and is visible`);
        if (optionCount > 0) {
          targetList = list;
          break; // Use the first visible dropdown with options
        }
      }
    } catch (e) {
      // Skip this list if it's not accessible
      continue;
    }
  }

  if (!targetList) {
    throw new Error('No visible dropdown with options found');
  }

  console.log(`✅ DROPDOWN: Using target dropdown`);

  // Get all options from the target dropdown
  const options = targetList.locator('[role="option"], [role="menuitem"], li');
  const count = await options.count();
  console.log(`📝 DROPDOWN: Found ${count} options in target dropdown`);

  if (count === 0) throw new Error('No dropdown options visible in target dropdown');

  // Log all available options for debugging
  for (let i = 0; i < Math.min(count, 10); i++) { // Log first 10 options
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
      // Skip this option if we can't read its text
      continue;
    }
  }

  // Try contains match
  for (let i = 0; i < count; i++) {
    const op = options.nth(i);
    try {
      const txt = (await op.innerText({ timeout: 1000 })).trim();
      if (ciContains(txt, desiredLabel)) {
        console.log(`🎯 DROPDOWN: Found fuzzy match: "${txt}" for "${desiredLabel}"`);
        await op.click();
        return txt;
      }
    } catch (e) {
      // Skip this option if we can't read its text
      continue;
    }
  }

  throw new Error(`Option not found in dropdown: "${desiredLabel}". Available options logged above.`);
}

async function selectComboboxOption(page: Page, labelRe: RegExp, desiredLabel: string) {
  console.log(`🎛️ SELECT: Starting selection for "${desiredLabel}" in combobox ${labelRe}`);

  const combo = await openCombobox(page, labelRe);

  // Wait a moment for the dropdown to fully open
  await sleep(500);

  // Type to filter when supported (some dropdowns support typing to filter)
  try {
    console.log(`⌨️ SELECT: Typing "${desiredLabel}" to filter options`);
    await page.keyboard.type(desiredLabel, { delay: 50 });
    await sleep(300); // Wait for filtering to take effect
  } catch (e) {
    console.log(`⌨️ SELECT: Typing not supported, proceeding with manual selection`);
  }

  const chosen = await pickFromOpenList(page, desiredLabel);

  // Wait for selection to take effect
  await sleep(300);

  // Verify the selection was reflected (optional verification)
  try {
    const text = await combo.innerText({ timeout: 3000 });
    const rx = new RegExp(chosen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (!rx.test(text)) {
      console.log(`⚠️ SELECT: Warning - Selection "${chosen}" not reflected in combobox text: "${text}"`);
      // Don't throw error, as sometimes the display text is different from the option text
    } else {
      console.log(`✅ SELECT: Selection "${chosen}" confirmed in combobox`);
    }
  } catch (e) {
    console.log(`⚠️ SELECT: Could not verify selection reflection: ${(e as Error).message}`);
  }

  console.log(`🎉 SELECT: Successfully selected "${chosen}"`);
  return chosen;
}

async function setAdvancedOff(page: Page) {
  // The control may be a switch or button. We try common roles/names.
  const candidates = [
    page.getByRole('switch', { name: /advanced settings/i }),
    page.getByRole('button', { name: /advanced settings/i }),
    page.getByLabel(/advanced settings/i),
  ];

  for (const cand of candidates) {
    if (await cand.count()) {
      try {
        await cand.scrollIntoViewIfNeeded();
        const el = cand.first();
        const ariaPressed = await el.getAttribute('aria-pressed');
        const ariaChecked = await el.getAttribute('aria-checked');
        const isOn = (ariaPressed === 'true') || (ariaChecked === 'true');
        if (isOn) {
          await el.click();
          // Best-effort re-check
          const pressed = await el.getAttribute('aria-pressed');
          const checked = await el.getAttribute('aria-checked');
          if ((pressed && pressed !== 'false') || (checked && checked !== 'false')) {
            // ignore
          }
        }
        return;
      } catch { /* continue probes */ }
    }
  }
  // If we didn't find it, assume OFF by default (UI sometimes hides it until a checkbox is enabled)
}

async function dismissOverlays(page: Page) {
  const buttons = [
    /accept/i, /agree/i, /ok/i, /got it/i, /dismiss/i, /close/i,
  ];
  for (const re of buttons) {
    const btn = page.getByRole('button', { name: re });
    if (await btn.count()) {
      try {
        await btn.first().click({ timeout: 1000 });
        await sleep(200);
      } catch { }
    }
  }
  // Also try common cookie banners
  const cookieSelectors = ['#cookie', '[data-testid*="cookie"]', '[id*="cookie"]', '[class*="cookie"]'];
  for (const sel of cookieSelectors) {
    const loc = page.locator(sel + ' button');
    if (await loc.count()) {
      try {
        await loc.first().click({ timeout: 1000 });
      } catch { }
    }
  }
}

// Collect text safely
async function safeInnerText(loc: import('playwright').Locator, fallback: string | null = null) {
  try { return (await loc.innerText({ timeout: 1500 })).trim(); } catch { return fallback; }
}

// ---------- Main automation function ----------
export async function runGcpCalculatorAutomation(estimateRequest: EstimateRequest): Promise<OutputJSON> {
  const collectArtifacts = estimateRequest.collectArtifacts === true; // default off
  const ART_DIR = path.resolve(process.cwd(), 'artifacts');
  const consoleLogPath = collectArtifacts ? path.join(ART_DIR, 'console.log') : undefined;
  const networkHarPath = collectArtifacts ? path.join(ART_DIR, 'network.har') : undefined;
  const estimatePng = collectArtifacts ? path.join(ART_DIR, 'estimate.png') : undefined;
  const sharePng = collectArtifacts ? path.join(ART_DIR, 'share.png') : undefined;

  let consoleStream: fs.WriteStream | null = null;
  if (collectArtifacts) {
    ensureDir(ART_DIR);
    try { if (consoleLogPath) fs.unlinkSync(consoleLogPath); } catch { }
    consoleStream = fs.createWriteStream(consoleLogPath!, { flags: 'a' });
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page;

  const out: OutputJSON = {
    success: false,
    artifacts: collectArtifacts ? {
      screenshots: {},
      consoleLogs: consoleLogPath,
      networkLogs: networkHarPath,
    } : undefined
  };

  try {
    const headless = estimateRequest.headless !== true; // default true
    const timeoutMs = estimateRequest.timeoutMs ?? 45000;

    browser = await chromium.launch({ headless });
    context = await browser.newContext({
      recordHar: collectArtifacts && networkHarPath ? { path: networkHarPath, content: 'embed' } : undefined,
      viewport: { width: 1440, height: 1000 },
      userAgent: 'Mozilla/5.0 (Playwright-Automation)',
      locale: 'en-US',
    });

    page = await context.newPage();
    if (!page) {
      throw new Error('Failed to create Playwright page');
    }
    page.setDefaultTimeout(timeoutMs);

    if (collectArtifacts && consoleStream) {
      page.on('console', msg => {
        try {
          consoleStream!.write(`[${new Date().toISOString()}] ${msg.type().toUpperCase()} ${msg.text()}\n`);
        } catch { }
      });
    }

    console.log(`🌐 BROWSER: Navigating to GCP Calculator: ${URL}`);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    console.log(`⏳ BROWSER: Waiting for page to load completely...`);
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    console.log(`🍪 BROWSER: Dismissing any overlays or popups...`);
    await dismissOverlays(page);

    // Sometimes the calculator loads inside an iframe—ensure main app is interactive
    // Click "Add to estimate" (top‑level)
    console.log(`🎯 BROWSER: Looking for 'Add to estimate' button...`);
    await clickWithRetry(
      () => Promise.resolve(page!.getByRole('button', { name: /add to estimate/i }).first()),
      'Add to estimate'
    );

    // Pick service card by fuzzy name
    // Service tiles are usually buttons or cards with accessible names
    console.log(`🎛️ BROWSER: Looking for service card: ${estimateRequest.service}`);
    await clickWithRetry(
      () => Promise.resolve(page!.getByRole('button', { name: new RegExp(estimateRequest.service, 'i') }).first()),
      `Service card: ${estimateRequest.service}`
    );

    // Ensure service type = Instances (radio/segmented)
    // Try common patterns
    console.log(`🔧 BROWSER: Setting service type to 'Instances'...`);
    const instancesToggle = page.getByRole('radio', { name: /instances/i }).or(
      page.getByRole('button', { name: /instances/i })
    );
    const instancesCount = await instancesToggle.count();
    console.log(`📊 BROWSER: Found ${instancesCount} 'instances' controls`);

    if (instancesCount > 0) {
      await clickWithRetry(() => Promise.resolve(instancesToggle.first()), 'Service type: Instances');
    } else {
      console.log(`⚠️ BROWSER: No 'instances' toggle found, assuming it's already selected`);
    }

    // Ensure Advanced settings OFF
    console.log(`🔧 BROWSER: Ensuring Advanced settings are OFF...`);
    await setAdvancedOff(page);
    console.log(`✅ BROWSER: Initial setup complete, starting form filling...`);

    type LineItem = {
      service: string;
      region: string;
      series: string;
      machineType: string;
      instances: number;
      totalHours: number;
      committedUse: string;
      os: string;
      subtotalText: string | null;
    };
    const lineItemSummaries: LineItem[] = [];

    // Helper to add one instance
    const addOneInstance = async (inst: InstanceInput, idx: number) => {
      console.log(`\n🔧 FORM: Filling instance ${idx + 1}/${estimateRequest.instances.length}`);
      console.log(`📋 FORM: Configuration:`, {
        instances: inst.numberOfInstances,
        hours: inst.totalHours,
        os: inst.operatingSystem,
        provisioning: inst.provisioningModel,
        series: inst.series,
        machineType: inst.machineType,
        region: inst.region,
        commitment: inst.committedUse
      });

      // Number of instances (text input)
      console.log(`📝 FORM: Setting number of instances to ${inst.numberOfInstances}`);
      const numInput = page.getByLabel(/number of instances/i);
      await numInput.fill(String(inst.numberOfInstances));

      // Total hours (per month) — UI label varies; try few options
      console.log(`⏰ FORM: Setting total hours to ${inst.totalHours}`);
      const hoursInput = page.getByLabel(/total hours|hours per month|hrs per month/i).first();
      if (await hoursInput.count()) {
        await hoursInput.fill(String(inst.totalHours));
      } else {
        console.log(`⚠️ FORM: Hours input not found, may use default`);
      }

      // Operating system
      console.log(`💻 FORM: Selecting operating system: ${inst.operatingSystem}`);

      // For Linux, we want the free option (Debian, CentOS, CoreOS, Ubuntu)
      let osToSelect = inst.operatingSystem;
      if (inst.operatingSystem.toLowerCase() === 'linux') {
        osToSelect = 'Free: Debian, CentOS, CoreOS, Ubuntu or BYOL';
        console.log(`💻 FORM: Converting 'Linux' to specific free option: ${osToSelect}`);
      } else if (inst.operatingSystem.toLowerCase() === 'windows') {
        osToSelect = 'Windows Server';
        console.log(`💻 FORM: Converting 'Windows' to Windows Server option`);
      }

      await selectComboboxOption(page, /operating system|os/i, osToSelect);

      // Provisioning model (Regular | Spot/Preemptible)
      console.log(`⚙️ FORM: Selecting provisioning model: ${inst.provisioningModel}`);

      // Try multiple possible field names for provisioning model
      const provisioningPatterns = [
        /provisioning model/i,
        /instance type/i,
        /vm type/i,
        /compute type/i,
        /pricing model/i,
        /billing model/i,
        /preemptible/i,
        /spot/i
      ];

      let provisioningSelected = false;
      for (const pattern of provisioningPatterns) {
        try {
          console.log(`🔍 FORM: Trying provisioning pattern: ${pattern}`);
          const comboCount = await page.getByRole('combobox', { name: pattern }).count();
          console.log(`📋 FORM: Found ${comboCount} comboboxes matching ${pattern}`);

          if (comboCount > 0) {
            await selectComboboxOption(page, pattern, inst.provisioningModel);
            provisioningSelected = true;
            break;
          }
        } catch (e) {
          console.log(`⚠️ FORM: Pattern ${pattern} failed: ${(e as Error).message}`);
          continue;
        }
      }

      if (!provisioningSelected) {
        console.log(`⚠️ FORM: No provisioning model dropdown found, trying specific radio button selectors`);

        // Use the specific selectors from the provided HTML structure
        const regularRadio = page.locator('input[type="radio"][value="regular"]');
        const spotRadio = page.locator('input[type="radio"][value="spot"]');

        const regularCount = await regularRadio.count();
        const spotCount = await spotRadio.count();
        console.log(`📊 FORM: Found ${regularCount} regular radios, ${spotCount} spot radios using specific selectors`);

        if (regularCount > 0 || spotCount > 0) {
          const isSpot = inst.provisioningModel.toLowerCase().includes('spot');
          const targetRadio = isSpot ? spotRadio : regularRadio;
          const targetLabel = isSpot ? 'Spot' : 'Regular';

          if (await targetRadio.count() > 0) {
            console.log(`🎯 FORM: Clicking ${targetLabel} radio button for provisioning model: ${inst.provisioningModel}`);

            // Check if already selected
            const isChecked = await targetRadio.isChecked();
            console.log(`🔍 FORM: ${targetLabel} radio button is currently ${isChecked ? 'checked' : 'unchecked'}`);

            if (!isChecked) {
              await targetRadio.click();
              console.log(`✅ FORM: ${targetLabel} radio button clicked`);
              // Wait for any UI updates after clicking
              await sleep(1500);
            } else {
              console.log(`✅ FORM: ${targetLabel} radio button already selected`);
            }

            provisioningSelected = true;
          }
        }

        if (!provisioningSelected) {
          console.log(`⚠️ FORM: Could not find any provisioning model controls, continuing...`);
        }
      }

      // Machine Family (first determine which family the series belongs to)
      console.log(`🏠 FORM: Determining machine family for series: ${inst.series}`);

      // Wait for form to update after provisioning model selection
      console.log(`⏳ FORM: Waiting for form to update after provisioning model change...`);
      await sleep(2000);

      // Map series to machine family based on GCP categorization
      const familyMap = {
        'e2': 'general-purpose',
        'n1': 'general-purpose',
        'n2': 'general-purpose',
        'n2d': 'general-purpose',
        'n4': 'general-purpose',
        't2d': 'general-purpose',
        't2a': 'general-purpose',
        'c3': 'compute-optimized',
        'c3d': 'compute-optimized',
        'c4': 'compute-optimized',
        'c4a': 'compute-optimized',
        'c4d': 'compute-optimized',
        'h3': 'compute-optimized',
        'm1': 'memory-optimized',
        'm2': 'memory-optimized',
        'm3': 'memory-optimized',
        'x4': 'memory-optimized',
        'a2': 'accelerator-optimized',
        'a3': 'accelerator-optimized',
        'g2': 'accelerator-optimized'
      };

      type FamilyMapKey = keyof typeof familyMap;
      const potentialKey = inst.series.toLowerCase();

      const machineFamily =
        (potentialKey in familyMap)
          ? familyMap[potentialKey as FamilyMapKey]
          : 'general-purpose';
      console.log(`🏠 FORM: Mapped ${inst.series} to family: ${machineFamily}`);

      try {
        // Click Machine Family dropdown using specific selector from HTML
        const familyDropdownButton = page.locator('[role="combobox"][aria-labelledby*="ucc-"]:has-text("Machine Family")').first();
        console.log(`🔍 FORM: Looking for Machine Family dropdown`);

        const familyDropdownCount = await familyDropdownButton.count();
        console.log(`📊 FORM: Found ${familyDropdownCount} Machine Family dropdowns`);

        if (familyDropdownCount > 0) {
          await familyDropdownButton.click();
          console.log(`🖱️ FORM: Clicked Machine Family dropdown`);
          await sleep(1000);

          // Select the family option using data-value
          const familyOption = page.locator(`[role="option"][data-value="${machineFamily}"]`);
          const familyOptionCount = await familyOption.count();
          console.log(`📊 FORM: Found ${familyOptionCount} family options for ${machineFamily}`);

          if (familyOptionCount > 0) {
            await familyOption.click();
            console.log(`✅ FORM: Machine Family selected: ${machineFamily}`);
            await sleep(1500);
          } else {
            console.log(`⚠️ FORM: Could not find family option: ${machineFamily}`);
          }
        } else {
          console.log(`⚠️ FORM: Could not find Machine Family dropdown`);
        }
      } catch (e) {
        console.log(`⚠️ FORM: Machine Family selection failed: ${(e as Error).message}`);
      }

      // Series
      console.log(`🏷️ FORM: Selecting series: ${inst.series}`);

      try {
        // Click Series dropdown using specific selector from HTML
        const seriesDropdownButton = page.locator('[role="combobox"][aria-labelledby*="ucc-"]:has-text("Series")').first();
        console.log(`🔍 FORM: Looking for Series dropdown`);

        const seriesDropdownCount = await seriesDropdownButton.count();
        console.log(`📊 FORM: Found ${seriesDropdownCount} Series dropdowns`);

        if (seriesDropdownCount > 0) {
          await seriesDropdownButton.click();
          console.log(`🖱️ FORM: Clicked Series dropdown`);
          await sleep(1000);

          // Select the series option - try both uppercase and lowercase
          const seriesUpper = inst.series.toUpperCase();
          const seriesLower = inst.series.toLowerCase();

          let seriesOption = page.locator(`[role="option"][data-value="${seriesLower}"]`);
          let seriesOptionCount = await seriesOption.count();

          if (seriesOptionCount === 0) {
            seriesOption = page.locator(`[role="option"][data-value="${seriesUpper}"]`);
            seriesOptionCount = await seriesOption.count();
          }

          console.log(`📊 FORM: Found ${seriesOptionCount} series options for ${inst.series}`);

          if (seriesOptionCount > 0) {
            await seriesOption.click();
            console.log(`✅ FORM: Series selected: ${inst.series}`);
            await sleep(1500);
          } else {
            console.log(`⚠️ FORM: Could not find series option: ${inst.series}`);
            throw new Error(`Series option not found: ${inst.series}`);
          }
        } else {
          console.log(`⚠️ FORM: Could not find Series dropdown`);
          throw new Error(`Series dropdown not found`);
        }
      } catch (e) {
        console.log(`⚠️ FORM: Series selection failed: ${(e as Error).message}`);
        throw new Error(`Could not select series: ${inst.series}. Error: ${(e as Error).message}`);
      }

      // Machine type (depends on Series)
      console.log(`🖥️ FORM: Selecting machine type: ${inst.machineType}`);

      try {
        // Click Machine Type dropdown using specific selector from HTML
        const machineTypeDropdownButton = page.locator('[role="combobox"][aria-labelledby*="ucc-"]:has-text("Machine type")').first();
        console.log(`🔍 FORM: Looking for Machine Type dropdown`);

        const machineTypeDropdownCount = await machineTypeDropdownButton.count();
        console.log(`📊 FORM: Found ${machineTypeDropdownCount} Machine Type dropdowns`);

        if (machineTypeDropdownCount > 0) {
          await machineTypeDropdownButton.click();
          console.log(`🖱️ FORM: Clicked Machine Type dropdown`);
          await sleep(1000);

          // Select the machine type option using data-value
          const machineTypeOption = page.locator(`[role="option"][data-value="${inst.machineType}"]`);
          const machineTypeOptionCount = await machineTypeOption.count();
          console.log(`📊 FORM: Found ${machineTypeOptionCount} machine type options for ${inst.machineType}`);

          if (machineTypeOptionCount > 0) {
            await machineTypeOption.click();
            console.log(`✅ FORM: Machine Type selected: ${inst.machineType}`);
            await sleep(1500);
          } else {
            console.log(`⚠️ FORM: Could not find machine type option: ${inst.machineType}`);
            throw new Error(`Machine type option not found: ${inst.machineType}`);
          }
        } else {
          console.log(`⚠️ FORM: Could not find Machine Type dropdown`);
          throw new Error(`Machine type dropdown not found`);
        }
      } catch (e) {
        console.log(`⚠️ FORM: Machine Type selection failed: ${(e as Error).message}`);
        throw new Error(`Could not select machine type: ${inst.machineType}. Error: ${(e as Error).message}`);
      }

      // Number of vCPUs (using specific selector from HTML structure)
      console.log(`🔢 FORM: Checking for vCPU input field`);
      try {
        // Look for the specific vCPU number input from the HTML structure
        const vcpuInput = page.locator('input[type="number"][jsname="YPqjbf"][aria-labelledby="ucc-45"]').first();
        const vcpuInputCount = await vcpuInput.count();
        console.log(`📊 FORM: Found ${vcpuInputCount} vCPU number input fields`);

        if (vcpuInputCount > 0) {
          // Extract vCPU count from machine type (e.g., "e2-standard-2" -> 2 vCPUs)
          const vcpuMatch = inst.machineType.match(/-(\d+)$/);
          let vcpuCount = vcpuMatch ? parseInt(vcpuMatch[1]) : 2;

          // For some machine types, the number represents different things
          if (inst.machineType.includes('standard-2')) vcpuCount = 2;
          else if (inst.machineType.includes('standard-4')) vcpuCount = 4;
          else if (inst.machineType.includes('standard-8')) vcpuCount = 8;
          else if (inst.machineType.includes('standard-16')) vcpuCount = 16;
          else if (inst.machineType.includes('standard-32')) vcpuCount = 32;
          else if (inst.machineType.includes('highmem-2')) vcpuCount = 2;
          else if (inst.machineType.includes('highmem-4')) vcpuCount = 4;
          else if (inst.machineType.includes('highmem-8')) vcpuCount = 8;
          else if (inst.machineType.includes('highcpu-2')) vcpuCount = 2;
          else if (inst.machineType.includes('highcpu-4')) vcpuCount = 4;
          else if (inst.machineType.includes('highcpu-8')) vcpuCount = 8;

          console.log(`🔢 FORM: Setting vCPUs to ${vcpuCount} for machine type ${inst.machineType}`);

          // Clear the field first, then fill with new value
          await vcpuInput.clear();
          await vcpuInput.fill(String(vcpuCount));
          console.log(`✅ FORM: vCPU field updated to ${vcpuCount}`);
          await sleep(500);
        } else {
          console.log(`ℹ️ FORM: vCPU number input field not found (may be automatically set by machine type)`);
        }
      } catch (e) {
        console.log(`⚠️ FORM: vCPU input handling failed: ${(e as Error).message}`);
      }

      // Amount of memory (using specific selector pattern from HTML structure)
      console.log(`💾 FORM: Checking for Memory input field`);
      try {
        // Look for the specific memory number input (likely aria-labelledby="ucc-48" based on pattern)
        const memoryInput = page.locator('input[type="number"][jsname="YPqjbf"][aria-labelledby="ucc-48"]').first();
        const memoryInputCount = await memoryInput.count();
        console.log(`📊 FORM: Found ${memoryInputCount} memory number input fields`);

        if (memoryInputCount > 0) {
          // Extract memory amount from machine type or estimate based on standard ratios
          let memoryGB = 8; // default
          if (inst.machineType.includes('standard-2')) memoryGB = 8;
          else if (inst.machineType.includes('standard-4')) memoryGB = 16;
          else if (inst.machineType.includes('standard-8')) memoryGB = 32;
          else if (inst.machineType.includes('standard-16')) memoryGB = 64;
          else if (inst.machineType.includes('standard-32')) memoryGB = 128;
          else if (inst.machineType.includes('highmem-2')) memoryGB = 16;
          else if (inst.machineType.includes('highmem-4')) memoryGB = 32;
          else if (inst.machineType.includes('highmem-8')) memoryGB = 64;
          else if (inst.machineType.includes('highcpu-2')) memoryGB = 4;
          else if (inst.machineType.includes('highcpu-4')) memoryGB = 8;
          else if (inst.machineType.includes('highcpu-8')) memoryGB = 16;

          console.log(`💾 FORM: Setting memory to ${memoryGB} GB for machine type ${inst.machineType}`);

          // Clear the field first, then fill with new value
          await memoryInput.clear();
          await memoryInput.fill(String(memoryGB));
          console.log(`✅ FORM: Memory field updated to ${memoryGB} GB`);
          await sleep(500);
        } else {
          console.log(`ℹ️ FORM: Memory number input field not found (may be automatically set by machine type)`);
        }
      } catch (e) {
        console.log(`⚠️ FORM: Memory input handling failed: ${(e as Error).message}`);
      }

      // Region
      console.log(`🌍 FORM: Selecting region: ${inst.region}`);
      await selectComboboxOption(page, /region|location/i, inst.region);

      // Committed use (None | 1 year | 3 years) — could be radio or dropdown
      console.log(`💰 FORM: Selecting committed use: ${inst.committedUse}`);

      // First try radios:
      const commitNone = page.getByRole('radio', { name: /none|no commitment/i });
      const commit1y = page.getByRole('radio', { name: /1 ?year/i });
      const commit3y = page.getByRole('radio', { name: /3 ?years?/i });
      const desired = inst.committedUse.toLowerCase();

      console.log(`🔍 FORM: Looking for commitment radio buttons...`);
      const noneCount = await commitNone.count();
      const oneYearCount = await commit1y.count();
      const threeYearCount = await commit3y.count();
      console.log(`📊 FORM: Found ${noneCount} 'none', ${oneYearCount} '1-year', ${threeYearCount} '3-year' radio buttons`);

      let committedSelected = false;
      if (noneCount > 0 || oneYearCount > 0 || threeYearCount > 0) {
        const target =
          desired === 'none' ? commitNone :
            desired.startsWith('1') ? commit1y : commit3y;
        if (await target.count()) {
          console.log(`🎯 FORM: Clicking commitment radio button for: ${desired}`);
          await target.first().click();
          committedSelected = true;
        }
      }
      if (!committedSelected) {
        // fallback: combobox
        console.log(`🔄 FORM: No radio buttons found, trying commitment dropdown`);
        await selectComboboxOption(page, /committed use|commitment/i, inst.committedUse);
      } else {
        console.log(`✅ FORM: Commitment selected via radio button`);
      }

      // Add to estimate (within the right-side of the form)
      // const addBtn = page.getByRole('button', { name: /add to estimate|add/i }).filter({ hasText: /add/i }).first();
      // await clickWithRetry(() => Promise.resolve(addBtn), 'Add to estimate (pane)');

      // Wait for right panel to show line item with expected attributes
      // const rightPanel = page.locator('[aria-label*="estimate"], [data-testid*="estimate"], .estimate, .right-panel').first();
      // await rightPanel.waitFor({ state: 'visible', timeout: 10000 });

      // Validate content appears; use fuzzy search
      // const expectTexts = [
      //   inst.region,
      //   inst.series,
      //   inst.machineType
      // ];
      // for (const t of expectTexts) {
      //   const rx = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      //   await page.getByText(rx).first().waitFor({ state: 'visible', timeout: 10000 });
      // }

      // Capture panel screenshot if enabled
      // if (collectArtifacts && estimatePng) {
      //   await page.screenshot({ path: estimatePng, fullPage: false });
      //   if (out.artifacts && out.artifacts.screenshots) {
      //     out.artifacts.screenshots.estimatePanel = estimatePng;
      //   }
      // }

      // Collect per‑line subtotal when visible (best‑effort)
      // Often each line card shows a subtotal or price snippet
      // const lineSubtotal = await safeInnerText(
      //   page.locator('text=/\\$[0-9,]+(\\.[0-9]{2})?/i').last(),
      //   null
      // );

      // lineItemSummaries.push({
      //   service: estimateRequest.service,
      //   region: inst.region,
      //   series: inst.series,
      //   machineType: inst.machineType,
      //   instances: inst.numberOfInstances,
      //   totalHours: inst.totalHours,
      //   committedUse: inst.committedUse,
      //   os: inst.operatingSystem,
      //   subtotalText: lineSubtotal
      // });
    };

    for (let i = 0; i < estimateRequest.instances.length; i++) {
      const inst = estimateRequest.instances[i];
      await addOneInstance(inst, i);

      // If the form resets between adds, re‑ensure Advanced OFF and correct service type
      await setAdvancedOff(page);
      const instancesToggleAgain = page.getByRole('radio', { name: /instances/i }).or(
        page.getByRole('button', { name: /instances/i })
      );
      if (await instancesToggleAgain.count()) {
        try { await instancesToggleAgain.first().click({ timeout: 1000 }); } catch { }
      }
    }

    // Validate total appears and looks like currency
    const totalLocatorCandidates = [
      page.getByText(/total.*\/\s*month/i),
      page.getByText(/^total/i),
      page.locator('text=/\\$[0-9,]+(\\.[0-9]{2})?\\s*\\/\\s*month/i')
    ];
    let totalText: string | null = null;
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
      // Fallback: scan visible currency
      const anyMoney = page.locator('text=/\\$[0-9,]+(\\.[0-9]{2})?/i').first();
      if (await anyMoney.count()) {
        totalText = await safeInnerText(anyMoney, null);
      }
    }
    if (!totalText) throw new Error('Total not found or not formatted as currency');

    // SHARE: Find and click the Share button using specific selector from HTML
    console.log(`🔗 SHARE: Looking for Share button`);
    const shareBtn = page.locator('button[aria-label="Open Share Estimate dialog"]').first();
    const shareBtnCount = await shareBtn.count();
    console.log(`📊 SHARE: Found ${shareBtnCount} Share buttons`);

    if (shareBtnCount > 0) {
      console.log(`🖱️ SHARE: Clicking Share button`);
      await clickWithRetry(() => Promise.resolve(shareBtn), 'Share button');
      console.log(`✅ SHARE: Share button clicked, waiting for modal`);
      await sleep(2000); // Wait for modal to open
    } else {
      // Fallback to generic share button search
      console.log(`⚠️ SHARE: Specific Share button not found, trying fallback`);
      const fallbackShareBtn = page.getByRole('button', { name: /share/i }).first();
      await clickWithRetry(() => Promise.resolve(fallbackShareBtn), 'Share button (fallback)');
      await sleep(2000);
    }

    if (collectArtifacts && sharePng) {
      await page.screenshot({ path: sharePng, fullPage: false });
      if (out.artifacts && out.artifacts.screenshots) {
        out.artifacts.screenshots.shareMenu = sharePng;
      }
    }

    // The share UI sometimes opens a popover with "Copy link" and "Download CSV"
    let shareUrl: string | undefined;
    let csvUrl: string | null | undefined;

    // Look for the Copy link button in the modal
    console.log(`🔍 SHARE: Looking for Copy link button in modal`);

    // Try to detect an input containing the share URL
    const shareInput = page.locator('input[type="text"], input[readonly], input').filter({ hasText: /https?:\/\//i }).first();

    // Look for "Copy link" button in the modal
    const copyLink = page.getByRole('button', { name: /copy link/i }).first();
    const copyLinkCount = await copyLink.count();
    console.log(`📊 SHARE: Found ${copyLinkCount} Copy link buttons`);

    if (copyLinkCount > 0) {
      console.log(`🖱️ SHARE: Clicking Copy link button`);
      // If a readonly input is next to it:
      try {
        const candidateInput = copyLink.locator('xpath=..').locator('input');
        const candidateInputCount = await candidateInput.count();
        console.log(`📊 SHARE: Found ${candidateInputCount} input fields near Copy link button`);

        if (candidateInputCount > 0) {
          shareUrl = (await candidateInput.first().inputValue()).trim();
          console.log(`✅ SHARE: Got URL from input field near Copy link: ${shareUrl.substring(0, 50)}...`);
        } else if (await shareInput.count()) {
          shareUrl = (await shareInput.inputValue()).trim();
          console.log(`✅ SHARE: Got URL from general share input: ${shareUrl.substring(0, 50)}...`);
        } else {
          // If clicking triggers a modal with the URL, try click once
          console.log(`🖱️ SHARE: Clicking Copy link to reveal URL`);
          await copyLink.click({ timeout: 2000 });
          await sleep(1000);

          // Check again for input after clicking
          const shareInputAfterClick = page.locator('input[type="text"], input[readonly], input').filter({ hasText: /https?:\/\//i }).first();
          if (await shareInputAfterClick.count()) {
            shareUrl = (await shareInputAfterClick.inputValue()).trim();
            console.log(`✅ SHARE: Got URL after clicking Copy link: ${shareUrl.substring(0, 50)}...`);
          }
        }
      } catch (e) {
        console.log(`⚠️ SHARE: Error handling Copy link: ${(e as Error).message}`);
      }
    }

    // Fallback: look for any textbox labeled "Share" with a URL
    if (!shareUrl) {
      const shareTextbox = page.getByRole('textbox').filter({ hasText: /https?:\/\//i }).first();
      if (await shareTextbox.count()) {
        try { shareUrl = (await shareTextbox.inputValue()).trim(); } catch { }
      }
    }

    // As a last resort, capture any visible link within the share popover
    if (!shareUrl) {
      const anyLink = page.locator('a[href^="https://cloud.google.com/products/calculator"]').first();
      if (await anyLink.count()) {
        shareUrl = (await anyLink.getAttribute('href')) || undefined;
      }
    }

    if (!shareUrl) throw new Error('Failed to capture share URL from Share UI');

    // CSV link (optional)
    if (estimateRequest.wantCsvLink) {
      const csvButton = page.getByRole('button', { name: /download csv|csv/i }).first();
      const csvLink = page.locator('a', { hasText: /download csv|csv/i }).first();
      csvUrl = null;
      if (await csvLink.count()) {
        const href = await csvLink.getAttribute('href');
        if (href && /^https?:\/\//i.test(href)) csvUrl = href;
      } else if (await csvButton.count()) {
        // If it triggers a download immediately, we cannot extract a URL reliably.
        csvUrl = null;
      }
    }

    out.success = true;
    out.shareUrl = shareUrl;
    out.csvDownloadUrl = estimateRequest.wantCsvLink ? (typeof csvUrl === 'undefined' ? null : csvUrl) : undefined;
    out.estimateSummary = {
      lineItems: lineItemSummaries,
      totalText
    };

    return out;
  } catch (err: any) {
    out.success = false;
    out.error = err?.message || String(err);
    return out;
  } finally {
    try { consoleStream?.end(); } catch { }
    try { await context?.close(); } catch { }
    try { await browser?.close(); } catch { }
  }
}

