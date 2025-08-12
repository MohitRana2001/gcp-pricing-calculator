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
  const combo = page.getByRole('combobox', { name: labelRe });
  await combo.scrollIntoViewIfNeeded();
  await combo.waitFor({ state: 'visible' });
  await combo.click();
  return combo;
}

async function pickFromOpenList(page: Page, desiredLabel: string) {
  // Tries exact, then fuzzy contains
  const list = page.locator('[role="listbox"], [role="menu"], .cdk-overlay-container, [data-test="mdc-list"]');
  await list.waitFor({ state: 'visible', timeout: 7000 });
  // All options
  const options = list.locator('[role="option"], [role="menuitem"], li, .mdc-list-item');
  const count = await options.count();
  if (count === 0) throw new Error('No dropdown options visible');

  // Try exact
  for (let i = 0; i < count; i++) {
    const op = options.nth(i);
    const txt = (await op.innerText()).trim();
    if (txt.toLowerCase() === desiredLabel.toLowerCase()) {
      await op.click();
      return txt;
    }
  }
  // Try contains
  for (let i = 0; i < count; i++) {
    const op = options.nth(i);
    const txt = (await op.innerText()).trim();
    if (ciContains(txt, desiredLabel)) {
      await op.click();
      return txt;
    }
  }
  throw new Error(`Option not found in dropdown: "${desiredLabel}"`);
}

async function selectComboboxOption(page: Page, labelRe: RegExp, desiredLabel: string) {
  const combo = await openCombobox(page, labelRe);
  // Type to filter when supported
  try {
    await page.keyboard.type(desiredLabel, { delay: 20 });
  } catch {}
  const chosen = await pickFromOpenList(page, desiredLabel);
  // Assert chosen reflected (manual check)
  const text = await combo.innerText({ timeout: 7000 });
  const rx = new RegExp(chosen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (!rx.test(text)) {
    throw new Error(`Selection not reflected: ${chosen}`);
  }
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
      } catch {}
    }
  }
  // Also try common cookie banners
  const cookieSelectors = ['#cookie', '[data-testid*="cookie"]', '[id*="cookie"]', '[class*="cookie"]'];
  for (const sel of cookieSelectors) {
    const loc = page.locator(sel + ' button');
    if (await loc.count()) {
      try {
        await loc.first().click({ timeout: 1000 });
      } catch {}
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
    try { if (consoleLogPath) fs.unlinkSync(consoleLogPath); } catch {}
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
    const headless = estimateRequest.headless !== false; // default true
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
        } catch {}
      });
    }

    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    await dismissOverlays(page);

    // Sometimes the calculator loads inside an iframe—ensure main app is interactive
    // Click "Add to estimate" (top‑level)
    await clickWithRetry(
      () => Promise.resolve(page!.getByRole('button', { name: /add to estimate/i }).first()),
      'Add to estimate'
    );

    // Pick service card by fuzzy name
    // Service tiles are usually buttons or cards with accessible names
    await clickWithRetry(
      () => Promise.resolve(page!.getByRole('button', { name: new RegExp(estimateRequest.service, 'i') }).first()),
      `Service card: ${estimateRequest.service}`
    );

    // Ensure service type = Instances (radio/segmented)
    // Try common patterns
    const instancesToggle = page.getByRole('radio', { name: /instances/i }).or(
      page.getByRole('button', { name: /instances/i })
    );
    if (await instancesToggle.count()) {
      await clickWithRetry(() => Promise.resolve(instancesToggle.first()), 'Service type: Instances');
    }

    // Ensure Advanced settings OFF
    await setAdvancedOff(page);

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
      // Number of instances (text input)
      const numInput = page.getByLabel(/number of instances/i);
      await numInput.fill(String(inst.numberOfInstances));

      // Total hours (per month) — UI label varies; try few options
      const hoursInput = page.getByLabel(/total hours|hours per month|hrs per month/i).first();
      if (await hoursInput.count()) {
        await hoursInput.fill(String(inst.totalHours));
      }

      // Operating system
      await selectComboboxOption(page, /operating system|os/i, inst.operatingSystem);

      // Provisioning model (Regular | Spot/Preemptible)
      await selectComboboxOption(page, /provisioning model/i, inst.provisioningModel);

      // Series
      await selectComboboxOption(page, /series/i, inst.series);

      // Machine type (depends on Series)
      await selectComboboxOption(page, /machine type|machine family|type/i, inst.machineType);

      // Region
      await selectComboboxOption(page, /region|location/i, inst.region);

      // Committed use (None | 1 year | 3 years) — could be radio or dropdown
      // First try radios:
      const commitNone = page.getByRole('radio', { name: /none|no commitment/i });
      const commit1y = page.getByRole('radio', { name: /1 ?year/i });
      const commit3y = page.getByRole('radio', { name: /3 ?years?/i });
      const desired = inst.committedUse.toLowerCase();

      let committedSelected = false;
      if (await commitNone.count() || await commit1y.count() || await commit3y.count()) {
        const target =
          desired === 'none' ? commitNone :
          desired.startsWith('1') ? commit1y : commit3y;
        if (await target.count()) {
          await target.first().click();
          committedSelected = true;
        }
      }
      if (!committedSelected) {
        // fallback: combobox
        await selectComboboxOption(page, /committed use|commitment/i, inst.committedUse);
      }

      // Add to estimate (within the right-side of the form)
      const addBtn = page.getByRole('button', { name: /add to estimate|add/i }).filter({ hasText: /add/i }).first();
      await clickWithRetry(() => Promise.resolve(addBtn), 'Add to estimate (pane)');

      // Wait for right panel to show line item with expected attributes
      const rightPanel = page.locator('[aria-label*="estimate"], [data-testid*="estimate"], .estimate, .right-panel').first();
      await rightPanel.waitFor({ state: 'visible', timeout: 10000 });

      // Validate content appears; use fuzzy search
      const expectTexts = [
        inst.region,
        inst.series,
        inst.machineType
      ];
      for (const t of expectTexts) {
        const rx = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        await page.getByText(rx).first().waitFor({ state: 'visible', timeout: 10000 });
      }

      // Capture panel screenshot if enabled
      if (collectArtifacts && estimatePng) {
        await page.screenshot({ path: estimatePng, fullPage: false });
        if (out.artifacts && out.artifacts.screenshots) {
          out.artifacts.screenshots.estimatePanel = estimatePng;
        }
      }

      // Collect per‑line subtotal when visible (best‑effort)
      // Often each line card shows a subtotal or price snippet
      const lineSubtotal = await safeInnerText(
        page.locator('text=/\\$[0-9,]+(\\.[0-9]{2})?/i').last(),
        null
      );

      lineItemSummaries.push({
        service: estimateRequest.service,
        region: inst.region,
        series: inst.series,
        machineType: inst.machineType,
        instances: inst.numberOfInstances,
        totalHours: inst.totalHours,
        committedUse: inst.committedUse,
        os: inst.operatingSystem,
        subtotalText: lineSubtotal
      });
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
        try { await instancesToggleAgain.first().click({ timeout: 1000 }); } catch {}
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

    // SHARE: open menu, click Copy link (or grab href/input)
    const shareBtn = page.getByRole('button', { name: /share/i }).first();
    await clickWithRetry(() => Promise.resolve(shareBtn), 'Share button');

    if (collectArtifacts && sharePng) {
      await page.screenshot({ path: sharePng, fullPage: false });
      if (out.artifacts && out.artifacts.screenshots) {
        out.artifacts.screenshots.shareMenu = sharePng;
      }
    }

    // The share UI sometimes opens a popover with "Copy link" and "Download CSV"
    let shareUrl: string | undefined;
    let csvUrl: string | null | undefined;

    // Try to detect an input containing the share URL
    const shareInput = page.locator('input[type="text"], input[readonly], input').filter({ hasText: /https?:\/\//i }).first();

    // Prefer an explicit "Copy link" control; we'll try to read the adjacent input value.
    const copyLink = page.getByRole('button', { name: /copy link/i }).first();
    if (await copyLink.count()) {
      // If a readonly input is next to it:
      try {
        const candidateInput = copyLink.locator('xpath=..').locator('input');
        if (await candidateInput.count()) {
          shareUrl = (await candidateInput.first().inputValue()).trim();
        } else if (await shareInput.count()) {
          shareUrl = (await shareInput.inputValue()).trim();
        } else {
          // If clicking triggers a modal with the URL, try click once
          await copyLink.click({ timeout: 2000 });
          await sleep(300);
          if (await shareInput.count()) {
            shareUrl = (await shareInput.inputValue()).trim();
          }
        }
      } catch {}
    }

    // Fallback: look for any textbox labeled "Share" with a URL
    if (!shareUrl) {
      const shareTextbox = page.getByRole('textbox').filter({ hasText: /https?:\/\//i }).first();
      if (await shareTextbox.count()) {
        try { shareUrl = (await shareTextbox.inputValue()).trim(); } catch {}
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
    try { consoleStream?.end(); } catch {}
    try { await context?.close(); } catch {}
    try { await browser?.close(); } catch {}
  }
}
