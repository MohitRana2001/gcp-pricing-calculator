// gcp-calculator.e2e.ts
import { chromium, Page } from 'playwright';

type InstanceInput = {
  numberOfInstances: number;
  // totalHours is optional; the modern form often assumes full month by default.
  totalHours?: number;
  operatingSystem: 'Linux' | 'Windows' | string;
  provisioningModel: 'Regular' | 'Spot' | string;
  series: string;            // e.g., "E2", "N2", "C4", "C3D"
  machineType: string;       // e.g., "e2-standard-4"
  region: string;            // e.g., "Iowa (us-central1)"
  committedUse: 'none' | '1 year' | '3 years';
};

const URL = 'https://cloud.google.com/products/calculator?hl=en';

// --- Utilities ---------------------------------------------------------------

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function dismissOverlays(page: Page) {
  // Cookie banners / one-off dialogs (best-effort)
  const candidates = [
    page.getByRole('button', { name: /accept|agree|allow|got it|ok|close|dismiss/i }),
    page.locator('[id*="cookie"], [class*="cookie"]').getByRole('button'),
  ];
  for (const c of candidates) {
    try {
      if (await c.count()) await c.first().click({ timeout: 1000 });
    } catch {}
  }
}

async function clickButton(page: Page, name: RegExp | string) {
  const btn = page.getByRole('button', { name }).first();
  await btn.waitFor({ state: 'visible' });
  await btn.click();
}

async function setTextboxByLabel(page: Page, label: RegExp | string, value: string) {
  const input = page.getByLabel(label).first();
  await input.waitFor({ state: 'visible' });
  await input.fill(value);
}

// A resilient dropdown selector that works with MDC / Material overlays.
// 1) Find trigger by accessible name, either role=combobox or a button with aria-haspopup=listbox.
// 2) Click to open.
// 3) Pick global option by role=option (overlays are appended to <body>).
async function selectDropdown(page: Page, fieldName: RegExp | string, optionText: string) {
  const trigger = page
    .getByRole('combobox', { name: fieldName })
    .or(page.getByRole('button', { name: fieldName }))
    .first();

  await trigger.waitFor({ state: 'visible' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  // Sometimes the accessible name of the trigger becomes "Field: Current value"
  // Typing can filter; safe to skip if not supported.
  try {
    await page.keyboard.type(optionText, { delay: 30 });
    await sleep(200);
  } catch {}

  // Options are in body-level overlay; use a global role=option query.
  const exact = page.getByRole('option', { name: new RegExp(`^${esc(optionText)}$`, 'i') }).first();
  const fuzzy = page.getByRole('option', { name: new RegExp(esc(optionText), 'i') }).first();

  if (await exact.count()) {
    await exact.scrollIntoViewIfNeeded();
    await exact.click();
  } else {
    await fuzzy.waitFor({ state: 'visible' });
    await fuzzy.scrollIntoViewIfNeeded();
    await fuzzy.click();
  }

  // (Best-effort) confirm the selection reflected on trigger — replace waitForFunction with a small typed poll.
  try {
    const target = optionText.toLowerCase();
    for (let i = 0; i < 20; i++) { // ~2s max
      const txt = (await trigger.textContent()) ?? '';
      if (txt.toLowerCase().includes(target)) break;
      await sleep(100);
    }
  } catch {}
}

async function setCommittedUse(page: Page, committedUse: InstanceInput['committedUse']) {
  const desired = committedUse.toLowerCase();

  // Try radios first
  const radioNone = page.getByRole('radio', { name: /no committed use|none/i }).first();
  const radio1y = page.getByRole('radio', { name: /1 ?year/i }).first();
  const radio3y = page.getByRole('radio', { name: /3 ?years?/i }).first();

  if (await radioNone.count() || await radio1y.count() || await radio3y.count()) {
    const target =
      desired === 'none' ? radioNone :
      desired.startsWith('1') ? radio1y : radio3y;

    if (await target.count()) {
      await target.click();
      return;
    }
  }

  // Fallback: dropdown labelled “Committed use”, “Commitment”, etc.
  const labels = [/committed use/i, /commitment/i];
  for (const l of labels) {
    const combobox = page.getByRole('combobox', { name: l }).or(
      page.getByRole('button', { name: l })
    ).first();

    if (await combobox.count()) {
      const text =
        desired === 'none' ? 'None' :
        desired.startsWith('1') ? '1 year' : '3 years';
      await selectDropdown(page, l, text);
      return;
    }
  }
}

// Map friendly OS names to actual option text displayed in the calculator.
function normalizeOsOption(os: string): string {
  const lower = os.toLowerCase().trim();
  if (lower === 'linux') return 'Free: Debian, CentOS, CoreOS, Ubuntu or BYOL';
  if (lower === 'windows' || lower === 'windows server') return 'Windows Server';
  return os; // pass-through for other precise labels
}

async function chooseProvisioning(page: Page, value: string) {
  const patterns = [/provisioning model/i, /instance type/i, /pricing model/i, /billing model/i, /spot|preemptible/i];
  for (const p of patterns) {
    const field = page.getByRole('combobox', { name: p }).or(
      page.getByRole('button', { name: p })
    ).first();
    if (await field.count()) {
      await selectDropdown(page, p, value);
      return;
    }
  }

  // Radios as fallback:
  const regular = page.getByRole('radio', { name: /regular|standard|on.?demand/i });
  const spot    = page.getByRole('radio',  { name: /spot|preemptible/i });

  const wantSpot = /spot|preempt/i.test(value.toLowerCase());
  const target = wantSpot ? spot : regular;

  if (await target.count()) {
    await target.first().click();
  }
}

// --- Main flow ---------------------------------------------------------------

export async function createComputeEngineEstimate(inst: InstanceInput) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 }, locale: 'en-US' });
  const page = await ctx.newPage();

  try {
    // 1) Open calculator
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await dismissOverlays(page);

    // 2) Click "Add to estimate"
    await clickButton(page, /add to estimate/i); // visible on the landing view
    // 3) Pick "Compute Engine" card
    //    Product tiles are buttons by accessible name.
    await clickButton(page, /^compute engine$/i);

    // 4) Ensure "Instances" view is active (some UIs show tabs like “Instances”, “Committed use”)
    const instancesToggle = page.getByRole('radio', { name: /instances/i })
      .or(page.getByRole('button', { name: /instances/i }))
      .first();
    if (await instancesToggle.count()) {
      try { await instancesToggle.click({ timeout: 1500 }); } catch {}
    }

    // 5) Fill the form
    await setTextboxByLabel(page, /number of instances/i, String(inst.numberOfInstances));

    // (Optional) Hours per month — not always present for CE
    if (typeof inst.totalHours === 'number') {
      const hours = page.getByLabel(/hours per month|total hours/i).first();
      if (await hours.count()) {
        await hours.fill(String(inst.totalHours));
      }
    }

    // Operating system
    await selectDropdown(page, /operating system|os/i, normalizeOsOption(inst.operatingSystem));

    // Provisioning model (Regular / Spot)
    await chooseProvisioning(page, inst.provisioningModel);

    // Series → Machine type
    await selectDropdown(page, /series|machine series|instance series|family/i, inst.series);
    await selectDropdown(page, /machine type|type/i, inst.machineType);

    // Region
    await selectDropdown(page, /region|location/i, inst.region);

    // Commitment
    await setCommittedUse(page, inst.committedUse);

    // 6) Add to estimate
    // In-form “Add to estimate” (not the landing one)
    const addInPane = page.getByRole('button', { name: /add to estimate|add/i }).first();
    await addInPane.click();

    // 7) Wait for the right panel to show a total
    const totalLike = page.getByText(/total.*\/\s*mo/i).first();
    await totalLike.waitFor({ state: 'visible', timeout: 10000 });

    // 8) Open Share and extract share URL
    await clickButton(page, /^share$/i);

    // Share popover typically exposes a readonly input with the URL
    const urlInput = page.locator('input[type="text"], input[readonly]').first();
    let shareUrl: string | null = null;
    if (await urlInput.count()) {
      shareUrl = (await urlInput.inputValue()).trim();
    } else {
      // Fallback: a link inside the popover
      const anyLink = page.locator('a[href*="cloud.google.com/products/calculator"]').first();
      if (await anyLink.count()) shareUrl = (await anyLink.getAttribute('href')) || null;
    }

    // CSV link (best-effort)
    let csvUrl: string | null = null;
    const csvLink = page.locator('a', { hasText: /csv/i }).first();
    if (await csvLink.count()) {
      const href = await csvLink.getAttribute('href');
      if (href && /^https?:\/\//i.test(href)) csvUrl = href;
    }

    return { success: true, shareUrl, csvUrl };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

// ----------------- Example run -----------------
if (require.main === module) {
  (async () => {
    const result = await createComputeEngineEstimate({
      numberOfInstances: 2,
      operatingSystem: 'Linux',
      provisioningModel: 'Regular',
      series: 'E2',
      machineType: 'e2-standard-4',
      region: 'Iowa (us-central1)',
      committedUse: 'none',
    });

    console.log(JSON.stringify(result, null, 2));
  })();
}
