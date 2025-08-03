import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser, Page, Locator } from 'playwright';
import { VmConfig } from '@/lib/calculator';

// Interface for the API request (updated to accept real VM configurations)
interface GenerateUrlRequest {
  configurations: VmConfig[]; // Array of VM configurations from spreadsheet
  options?: {
    headless?: boolean;
    timeout?: number;
  };
}

// Interface for the API response
interface GenerateUrlResponse {
  success: boolean;
  shareUrl?: string;
  csvDownloadUrl?: string; // Optional CSV download
  error?: string;
  details?: {
    machineType: string;
    region: string;
    timestamp: string;
  };
}

/**
 * Selects an <option role="option"> from an ARIA listbox that belongs to the
 * given combobox. If nothing matches it just returns false.
 *
 * @param combo   The locator for the combobox (role=combobox)
 * @param optionRx A case-insensitive RegExp for the label you want
 * @param page    Playwright Page (needed only for PageDown scrolling)
 */
async function chooseFromCombobox(
  combo   : Locator,
  optionRx: RegExp,
  page    : Page
): Promise<boolean> {

  console.log(`🔍 chooseFromCombobox: Looking for pattern: ${optionRx}`);

  // 1. open the dropdown ----------------------------------------------------
  await combo.click();
  console.log('✅ Combobox clicked');

  const listId = await combo.getAttribute('aria-controls');
  if (!listId) throw new Error('combobox has no aria-controls');
  console.log(`✅ Found aria-controls: ${listId}`);

  const list = combo.page().locator(`#${listId}`);
  await list.waitFor({ state: 'visible', timeout: 5_000 });
  console.log('✅ List is visible');

  // Debug: Check initial state
  const initialCount = await list.locator('li[role="option"]').count();
  console.log(`📊 Initial options count: ${initialCount}`);
  
  if (initialCount > 0) {
    console.log('📋 Sampling first few options:');
    for (let i = 0; i < Math.min(5, initialCount); i++) {
      const optionText = await list.locator('li[role="option"]').nth(i).textContent();
      const optionValue = await list.locator('li[role="option"]').nth(i).getAttribute('data-value');
      console.log(`  [${i}] Text: "${optionText}" | data-value: "${optionValue}"`);
    }
  }

  // 2. try to find the option; if list is virtualised scroll until we see it
  for (let i = 0; i < 40; i++) { // 40×PageDown ~= entire list
    try {
      // Check if list is still visible
      const currentCount = await list.locator('li[role="option"]').count();
      if (currentCount === 0) {
        console.log(`⚠️ List became empty at iteration ${i}, attempting to reopen...`);
        
        // Try to reopen the dropdown
        await page.keyboard.press('Escape'); // Close if open
        await page.waitForTimeout(500);
        await combo.click(); // Reopen
        await list.waitFor({ state: 'visible', timeout: 5000 });
        
        const reopenCount = await list.locator('li[role="option"]').count();
        console.log(`📊 After reopening: ${reopenCount} options`);
        
        if (reopenCount === 0) {
          console.log('❌ Could not reopen dropdown, breaking');
          break;
        }
      }

      const opt = list.getByRole('option', { name: optionRx }).first();
      const optCount = await opt.count();
      
      if (optCount > 0) {
        console.log(`✅ Found matching option after ${i} attempts`);
        const foundText = await opt.textContent();
        const foundValue = await opt.getAttribute('data-value');
        console.log(`📋 Found option - Text: "${foundText}" | data-value: "${foundValue}"`);
        
        await opt.scrollIntoViewIfNeeded();
        await opt.click();
        return true;               // SUCCESS
      }
      
      // Debug: Log current visible options every 10 iterations
      if (i % 10 === 0) {
        const currentCount = await list.locator('li[role="option"]').count();
        console.log(`📊 After ${i} scrolls: ${currentCount} visible options`);
        
        if (currentCount > 0) {
          const firstOption = await list.locator('li[role="option"]').first().textContent();
          const lastOption = await list.locator('li[role="option"]').last().textContent();
          console.log(`📋 Range: "${firstOption}" ... "${lastOption}"`);
          
          // Check if our target might be in current visible options
          const allTexts = await list.locator('li[role="option"]').allTextContents();
          const matchingTexts = allTexts.filter(text => optionRx.test(text));
          if (matchingTexts.length > 0) {
            console.log(`🎯 Found potential matches in visible options: ${matchingTexts}`);
          }
        }
      }
      
      // Use a more gentle scrolling approach
      if (currentCount > 0) {
        // Try scrolling the list element directly first
        await list.evaluate(el => el.scrollBy(0, el.clientHeight / 3));
        await page.waitForTimeout(200); // Longer delay for UI to stabilize
        
        // Check if that worked, if not try keyboard
        const afterScrollCount = await list.locator('li[role="option"]').count();
        if (afterScrollCount === 0) {
          console.log(`⚠️ Direct scroll failed, trying keyboard at iteration ${i}`);
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowDown');
        }
      }
      
    } catch (error) {
      // If the list gets detached, try to re-find it
      console.log(`⚠️ Error during scroll, attempt ${i + 1}/40: ${error}`);
      try {
        await list.waitFor({ state: 'visible', timeout: 1000 });
        console.log('✅ Reconnected to list');
      } catch (reconnectError) {
        // If we can't reconnect, break out of the loop
        console.log('⚠️ Could not reconnect to list, breaking');
        break;
      }
    }
  }

  // 3. Final debug before giving up
  console.log('❌ Option not found. Final debug info:');
  try {
    const finalCount = await list.locator('li[role="option"]').count();
    console.log(`📊 Final options count: ${finalCount}`);
    
    if (finalCount > 0) {
      console.log('📋 Final visible options sample:');
      const finalTexts = await list.locator('li[role="option"]').allTextContents();
      finalTexts.slice(0, 10).forEach((text, i) => {
        console.log(`  [${i}] "${text}"`);
      });
      
      if (finalTexts.length > 10) {
        console.log(`  ... and ${finalTexts.length - 10} more options`);
      }
    }
  } catch (debugError) {
    console.log('⚠️ Final debug failed:', debugError);
  }

  // not found – close the listbox and tell caller we skipped
  await page.keyboard.press('Escape');
  return false;
}

/**
 * Selects a machine type from a virtualized dropdown using multiple strategies
 * for more reliable targeting.
 *
 * @param combo The locator for the combobox (role=combobox)
 * @param code  The machine type code (e.g. e2-standard-16)
 */
async function chooseMachineType(
  combo   : Locator,
  code    : string               // e.g. e2-standard-16
): Promise<boolean> {

  await combo.click();

  const listId = await combo.getAttribute('aria-controls');
  if (!listId) throw new Error('combobox has no aria-controls');

  const list = combo.page().locator(`#${listId}`);
  await list.waitFor({ state: 'visible', timeout: 5_000 });

  // Strategy 1: Try to find by data-value attribute
  console.log(`🔍 Strategy 1: Looking for data-value="${code}"`);
  let quick = list.locator(`li[role="option"][data-value="${code}"]`);
  if (await quick.count()) { 
    console.log('✅ Found by data-value, clicking...');
    await quick.click(); 
    return true; 
  }

  // Strategy 2: Try to find by text content (case insensitive)
  console.log(`🔍 Strategy 2: Looking for text content containing "${code}"`);
  quick = list.getByRole('option', { name: new RegExp(code.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') });
  if (await quick.count()) { 
    console.log('✅ Found by text content, clicking...');
    await quick.click(); 
    return true; 
  }

  // Strategy 3: Scroll through the list and check both methods
  console.log(`🔍 Strategy 3: Scrolling through virtualized list...`);
  for (let i = 0; i < 60; i++) {
    // Try data-value approach
    quick = list.locator(`li[role="option"][data-value="${code}"]`);
    if (await quick.count()) { 
      console.log(`✅ Found by data-value after ${i} scrolls, clicking...`);
      await quick.scrollIntoViewIfNeeded();
      await quick.click(); 
      return true; 
    }

    // Try text content approach
    quick = list.getByRole('option', { name: new RegExp(code.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') });
    if (await quick.count()) { 
      console.log(`✅ Found by text content after ${i} scrolls, clicking...`);
      await quick.scrollIntoViewIfNeeded();
      await quick.click(); 
      return true; 
    }

    // Scroll the list element
    try {
      await list.evaluate(el => el.scrollBy(0, el.clientHeight / 2));
      await combo.page().waitForTimeout(100); // Small delay for rendering
    } catch (error) {
      console.log(`⚠️ Scroll failed at iteration ${i}: ${error}`);
      break;
    }

    // Debug: Log current visible options every 10 iterations
    if (i % 10 === 0) {
      try {
        const visibleOptions = await list.locator('li[role="option"]').count();
        console.log(`📊 After ${i} scrolls: ${visibleOptions} visible options`);
        
        // Log a few option texts for debugging
        if (visibleOptions > 0) {
          const firstFew = await list.locator('li[role="option"]').first().textContent();
          const lastFew = await list.locator('li[role="option"]').last().textContent();
          console.log(`📋 First option: "${firstFew}", Last option: "${lastFew}"`);
        }
      } catch (debugError) {
        console.log('⚠️ Debug info failed:', debugError);
      }
    }
  }

  // Strategy 4: Final attempt with keyboard navigation
  console.log(`🔍 Strategy 4: Using keyboard navigation...`);
  try {
    // Focus the list and use arrow keys
    await list.focus();
    for (let i = 0; i < 100; i++) {
      const currentOption = list.locator('[aria-selected="true"], [data-focused="true"], .focused');
      const currentText = await currentOption.textContent().catch(() => '');
      
      if (currentText && currentText.toLowerCase().includes(code.toLowerCase())) {
        console.log(`✅ Found by keyboard navigation: "${currentText}"`);
        await combo.page().keyboard.press('Enter');
        return true;
      }
      
      await combo.page().keyboard.press('ArrowDown');
      await combo.page().waitForTimeout(50);
    }
  } catch (keyboardError) {
    console.log('⚠️ Keyboard navigation failed:', keyboardError);
  }

  // Give up
  console.log(`❌ Machine type "${code}" not found after all strategies`);
  await combo.page().keyboard.press('Escape');
  return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let context: any = null;
  
  try {
    const body: GenerateUrlRequest = await request.json();
    const { configurations = [], options = {} } = body;

    console.log(`🤖 Starting GCP Calculator automation for ${configurations.length} configurations`);

    // Browser configuration
    browser = await chromium.launch({
      headless: options.headless !== false, // Set to false in request for visual debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        // Hardening: Prevent clipboard blocking in CI runners
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    // Context with permissions
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      permissions: ['clipboard-read', 'clipboard-write'], // Enable clipboard access
    });

    page = await context.newPage();

    if (!page) {
      throw new Error('Failed to create page');
    }

    // Step 1: Open the calculator
    console.log('📱 Step 1: Navigating to GCP Calculator...');
    await page.goto('https://cloud.google.com/products/calculator?hl=en', {
      waitUntil: 'networkidle',
      timeout: options.timeout || 30000
    });

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Give time for dynamic content

    // Step 2: Start an estimate - Click "Add to estimate" in hero area
    console.log('🎯 Clicking the hero "Add to estimate"...');
    await page.getByRole('button', { name: /^add to estimate$/i }).first().click();

    // Wait a moment for the dialog to appear
    await page.waitForTimeout(2000);

    // Debug: Let's see what's actually on the page
    console.log('🔍 Debugging page content after clicking "Add to estimate"...');
    const dialogs = await page.locator('[role="dialog"]').count();
    console.log(`📊 Found ${dialogs} elements with role="dialog"`);
    
    if (dialogs > 0) {
      const dialogTexts = await page.locator('[role="dialog"]').allTextContents();
      console.log('📋 Dialog contents:', dialogTexts);
    }

    /* wait for the product-picker dialog once, then keep a handle to it */
    console.log('🔍 Waiting for product picker dialog...');
    
    // Use the stable aria-label attribute for the modal
    const picker = page.locator('div[aria-label="Add to this estimate"]');
    await picker.waitFor({ state: 'visible', timeout: 10_000 });
    console.log('✅ Product picker dialog visible');

    // Step 3: Click the "Compute Engine" tile
    console.log('🔧 Step 3: Clicking "Compute Engine" tile...');
    
    // Use the stable data-service-form attribute for Compute Engine (data-service-form="8")
    const computeEngineButton = picker.locator('div[role="button"][data-service-form="8"]');
    await computeEngineButton.scrollIntoViewIfNeeded();
    await computeEngineButton.click();
    console.log('✅ Compute Engine card clicked using stable data-service-form attribute');

    // Wait for configuration form to slide out
    await page.waitForTimeout(3000);

    // Step 4: Configure the VM (following exact table from user)
    console.log('⚙️ Step 4: Configuring VM settings...');

    // Wait for the form to load and debug what's available
    await page.waitForTimeout(3000);
    
    console.log('🔍 Debugging available form elements...');
    
    // Check for any elements with data-form-id
    const formIds = await page.locator('[data-form-id]').count();
    console.log(`📊 Found ${formIds} elements with data-form-id`);
    
    if (formIds > 0) {
      const formIdValues = await page.locator('[data-form-id]').evaluateAll(elements => 
        elements.map(el => el.getAttribute('data-form-id'))
      );
      console.log('📋 Available data-form-id values:', formIdValues);
    }

    // Check for Compute Engine related elements
    const computeEngineElements = await page.locator('*:has-text("Compute Engine")').count();
    console.log(`📊 Found ${computeEngineElements} elements containing "Compute Engine" text`);

    // Try to find the form using multiple approaches
    let tile = null;
    
    // Approach 1: Try the specific data-form-id
    try {
      tile = page.locator('[data-form-id="B1360350-B2C4-4F03-A882-C613110448AF"]');
      await tile.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ Found form using specific data-form-id');
    } catch (error) {
      console.log('⚠️ Specific data-form-id not found, trying alternative approaches...');
      
      // Approach 2: Try any data-form-id
      try {
        tile = page.locator('[data-form-id]').first();
        await tile.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✅ Found form using first available data-form-id');
      } catch (error) {
        console.log('⚠️ No data-form-id found, trying page-level selectors...');
        tile = page; // Use page as fallback
      }
    }

    // Use the first configuration for now (we'll handle multiple configs later)
    const config = configurations[0];
    if (!config) {
      throw new Error('No VM configurations provided');
    }

    // Configure Region using the robust helper
    console.log(`🌍 Configuring region: ${config.regionLocation}`);
    const regionOk = await chooseFromCombobox(
      tile.getByRole('combobox', { name: /region/i }),
      new RegExp(config.regionLocation, 'i'),
      page
    );
    console.log(regionOk ? '✅ Region set' : '⚠️ Region not available – skipped');

    // Configure Series (avoid strict-mode clash)
    console.log(`⚙️ Configuring series: ${config.series.toUpperCase()}`);
    const seriesOk = await chooseFromCombobox(
      tile.getByRole('combobox', { name: /^series$/i }),
      new RegExp(`^${config.series}\\b`, 'i'),   // "^C4\b" matches C4 only
      page
    );
    console.log(seriesOk ? '✅ Series set' : '⚠️ Series not available – skipped');

    // Wait for machine type dropdown to update based on series selection
    if (seriesOk) {
      console.log('⏳ Waiting for machine type list to update after series selection...');
      await page.waitForTimeout(2000); // Give time for the UI to update machine types
    }

    // Configure Machine Type
    console.log(`🔧 Configuring machine type: ${config.name}`);
    console.log(`🔍 Machine type regex pattern: ${new RegExp(config.name, 'i')}`);
    console.log(`🔍 Testing regex against sample texts:`);
    console.log(`  - "${config.name}" matches: ${new RegExp(config.name, 'i').test(config.name)}`);
    console.log(`  - "e2-standard-16" matches: ${new RegExp(config.name, 'i').test('e2-standard-16')}`);
    console.log(`  - "e2-standard-16 (16 vCPU, 64 GB memory)" matches: ${new RegExp(config.name, 'i').test('e2-standard-16 (16 vCPU, 64 GB memory)')}`);
    
    const machineOk = await chooseFromCombobox(
      tile.getByRole('combobox', { name: /^machine type/i }),
      new RegExp(config.name, 'i'),
      page
    );
    console.log(machineOk ? '✅ Machine set' : '⚠️ Machine type not available');

    // Configure Number of instances
    console.log(`📊 Configuring number of instances: ${config.quantity}`);
    try {
      // Use more forgiving regex without caret anchor and handle the asterisk
      const instancesInput = tile.getByRole('spinbutton', { name: /number of instances/i });
      
      // Debug: Check initial value
      const initialValue = await instancesInput.inputValue();
      console.log(`🔍 Initial number of instances value: "${initialValue}"`);
      
      // Ensure the input is fully visible and focused properly
      await instancesInput.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300); // Let scroll complete
      
      // Strategy 1: Standard approach
      console.log('🔄 Strategy 1: Standard fill approach');
      await instancesInput.focus();
      await instancesInput.click();
      await instancesInput.selectText();
      await instancesInput.fill(config.quantity.toString());
      await instancesInput.press('Enter');
      await page.waitForTimeout(500);
      
      // Check if it worked
      let currentValue = await instancesInput.inputValue();
      console.log(`🔍 After strategy 1 - Value: "${currentValue}"`);
      
      if (currentValue !== config.quantity.toString()) {
        console.log('🔄 Strategy 2: Clear and type approach');
        await instancesInput.focus();
        await instancesInput.press('Control+a'); // Select all
        await instancesInput.press('Backspace'); // Clear
        await instancesInput.type(config.quantity.toString()); // Type character by character
        await instancesInput.press('Tab'); // Try Tab instead of Enter
        await page.waitForTimeout(500);
        
        currentValue = await instancesInput.inputValue();
        console.log(`🔍 After strategy 2 - Value: "${currentValue}"`);
      }
      
      if (currentValue !== config.quantity.toString()) {
        console.log('🔄 Strategy 3: Blur event approach');
        await instancesInput.focus();
        await instancesInput.fill('');
        await instancesInput.fill(config.quantity.toString());
        await instancesInput.blur(); // Try blur instead of Enter/Tab
        await page.waitForTimeout(500);
        
        currentValue = await instancesInput.inputValue();
        console.log(`🔍 After strategy 3 - Value: "${currentValue}"`);
      }
      
      if (currentValue !== config.quantity.toString()) {
        console.log('🔄 Strategy 4: Stepper button approach');
        // If direct input doesn't work, try using the increment/decrement buttons
        const targetValue = parseInt(config.quantity.toString());
        const currentValueNum = parseInt(currentValue);
        
        if (targetValue > currentValueNum) {
          const incrementsNeeded = targetValue - currentValueNum;
          console.log(`📈 Need to increment ${incrementsNeeded} times`);
          
          // Look for increment button (usually a + button near the input)
          const incrementButton = tile.locator('button[aria-label*="increment"], button[title*="increment"], button:has-text("+")').first();
          
          for (let i = 0; i < incrementsNeeded && i < 20; i++) { // Cap at 20 for safety
            try {
              await incrementButton.click();
              await page.waitForTimeout(100);
            } catch (e) {
              console.log(`⚠️ Increment button click failed: ${e}`);
              break;
            }
          }
        } else if (targetValue < currentValueNum) {
          const decrementsNeeded = currentValueNum - targetValue;
          console.log(`📉 Need to decrement ${decrementsNeeded} times`);
          
          // Look for decrement button (usually a - button near the input)
          const decrementButton = tile.locator('button[aria-label*="decrement"], button[title*="decrement"], button:has-text("-")').first();
          
          for (let i = 0; i < decrementsNeeded && i < 20; i++) { // Cap at 20 for safety
            try {
              await decrementButton.click();
              await page.waitForTimeout(100);
            } catch (e) {
              console.log(`⚠️ Decrement button click failed: ${e}`);
              break;
            }
          }
        }
        
        currentValue = await instancesInput.inputValue();
        console.log(`🔍 After strategy 4 - Value: "${currentValue}"`);
      }
      
      // Final check
      const finalValue = await instancesInput.inputValue();
      if (finalValue === config.quantity.toString()) {
        console.log('✅ Number of instances configured successfully');
      } else {
        console.log(`⚠️ Number of instances may not be set correctly. Expected: ${config.quantity}, Actual: ${finalValue}`);
      }
      
    } catch (error) {
      console.log('⚠️ Could not configure number of instances:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Configure Total instance usage time
    console.log(`⏱️ Configuring usage time: ${config.runningHours} hours`);
    try {
      const usageInput = tile.getByRole('spinbutton', { name: /total instance usage time/i });
      
      // Same robust approach for usage time
      await usageInput.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      
      await usageInput.focus();
      await usageInput.click();
      await usageInput.selectText();
      await usageInput.fill(config.runningHours.toString());
      await usageInput.press('Enter');
      await page.waitForTimeout(500);
      
      console.log('✅ Usage time configured');
    } catch (error) {
      console.log('⚠️ Could not configure usage time:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Configure Units to hours
    console.log('🕐 Configuring units: hours');
    try {
      await tile.getByRole('combobox', { name: 'Units' }).click();
      await page.getByRole('option', { name: 'hours' }).click();
      console.log('✅ Units configured');
    } catch (error) {
      console.log('⚠️ Could not configure units:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Configure Time period to per month
    console.log('📅 Configuring time period: per month');
    try {
      await tile.getByRole('combobox', { name: 'Time period' }).click();
      await page.getByRole('option', { name: 'per month' }).click();
      console.log('✅ Time period configured');
    } catch (error) {
      console.log('⚠️ Could not configure time period:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Configure Operating System (default to Linux)
    console.log('💻 Configuring operating system: Linux');
    const osOk = await chooseFromCombobox(
      tile.getByRole('combobox', { name: /^Operating System/i }),
      /linux/i,                       // <- any option whose name contains "linux"
      page
    );
    console.log(osOk ? '✅ Operating system configured' : '⚠️ Operating system not available – skipped');

    // Configure Committed Use Discount based on discount model
    console.log(`🔄 Configuring committed use discount: ${config.discountModel}`);

    const cudMap: Record<string, RegExp> = {
      'None'       : /^None$/i,
      '1-Year CUD' : /1 ?Year/i,
      '3-Year CUD' : /3 ?Year/i,
      'Spot VM'    : /Spot/i,
    };
    const cudSelector = cudMap[config.discountModel] ?? cudMap['None'];

    try {
      // The UI has changed to a material-select combobox
      console.log('🔍 Looking for Committed use discount combobox...');
      const cudCombobox = tile.getByRole('combobox', { name: /committed use discount options/i });
      
      const cudOk = await chooseFromCombobox(
        cudCombobox,
        cudSelector,
        page
      );
      
      console.log(cudOk ? '✅ Committed-use discount configured' : '⚠️ Committed-use discount not available – skipped');
    } catch (e) {
      console.log('⚠️ Could not configure committed-use discount:',
                  e instanceof Error ? e.message : 'Unknown error');
    }

    // Step 5: Add to estimate
    // console.log('+ Adding to estimate...');
    // const addToEstimateButton = page.getByRole('button', { name: /^add to estimate$/i }).last();
    // await addToEstimateButton.scrollIntoViewIfNeeded();
    // await addToEstimateButton.click();
    // await page.waitForTimeout(2_000);            // let the card collapse

    // // Wait for estimate to be added and form to collapse
    // await page.waitForTimeout(3000);

    // Step 6: Generate the share link
    const shareUrl = await generateShareLink(page);

    return NextResponse.json<GenerateUrlResponse>({
      success: true,
      shareUrl,
      details: {
        machineType: config.name,
        region: config.regionLocation,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in GCP URL generation:', error);
    
    return NextResponse.json<GenerateUrlResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  } finally {
    // Proper resource cleanup
    if (page) {
      await page.close().catch(console.error);
    }
    if (browser) {
      await browser.close().catch(console.error);
    }
  }
}

// Function to generate share link following user's exact steps
async function generateShareLink(page: Page): Promise<string> {
  console.log('🔗 Step 6: Generating share link...');
  
  // 1️⃣ Click the "link" (Share-estimate) button - using the span with link icon
  const shareBtn = page.locator('span:has(i[aria-hidden="true"]:has-text("link"))').first();
  await shareBtn.click();
  console.log('✅ Share button clicked');
  
  // Wait for the modal to appear
  await page.waitForTimeout(2000);
  
  // 2️⃣ Look for the modal and copy link button with multiple approaches
  let copyBtn = null;
  
  // Try multiple modal selectors
  const modalSelectors = [
    'dialog[aria-label*="Share"]',
    'div[role="dialog"]:has-text("Copy link")',
    '[data-testid*="share"]',
    '.modal:has-text("Copy link")'
  ];
  
  for (const modalSelector of modalSelectors) {
    try {
      const modal = page.locator(modalSelector);
      if (await modal.isVisible({ timeout: 3000 })) {
        copyBtn = modal.getByRole('button', { name: /copy link/i });
        if (await copyBtn.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found copy button in modal: ${modalSelector}`);
          break;
        }
      }
    } catch (error) {
      console.log(`⚠️ Modal selector failed: ${modalSelector}`);
      continue;
    }
  }
  
  // Fallback: Look for copy link button anywhere on the page
  if (!copyBtn) {
    try {
      copyBtn = page.getByRole('button', { name: /copy link/i });
      if (await copyBtn.isVisible({ timeout: 3000 })) {
        console.log('✅ Found copy button on page level');
      }
    } catch (error) {
      console.log('⚠️ Could not find copy button anywhere');
    }
  }
  
  if (!copyBtn) {
    throw new Error('Could not find copy link button');
  }
  
  // 3️⃣ Click the copy button and wait for clipboard
  await copyBtn.click();
  console.log('✅ Copy link button clicked');
  
  // Wait a moment for clipboard operation
  await page.waitForTimeout(2000);
  
  // 4️⃣ Grab the URL from the clipboard
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  console.log('🔗 Shared URL:', sharedUrl);
  
  if (sharedUrl && sharedUrl.includes('cloud.google.com')) {
    return sharedUrl;
  }

  throw new Error('Share URL not found in clipboard');
} 