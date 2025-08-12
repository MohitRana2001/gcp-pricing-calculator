// GCP Pricing Calculator URL Generator (Advanced Playwright-based)
// Uses comprehensive browser automation to interact with the official Google Cloud Pricing Calculator

import { VmConfig } from './calculator';
import { validateVmConfigsForAutomation, getAutomationErrorHelp } from './gcpConfigAdapter';

// Base URL for the API endpoint
const API_BASE_URL = '/api/generate-gcp-url';

// Interface for API response (updated to match new automation)
interface GenerateUrlResponse {
  success: boolean;
  shareUrl?: string;
  csvDownloadUrl?: string | null;
  error?: string;
  errorHelp?: string;
  details?: {
    configurationsProcessed: number;
    timestamp: string;
    summary?: {
      totalCost?: string;
      lineItems?: Array<{
        service: string;
        region: string;
        machineType: string;
        instances: number;
        subtotal?: string;
      }>;
    };
  };
  artifacts?: {
    screenshots?: {
      estimatePanel?: string;
      shareMenu?: string;
      lastError?: string;
    };
    logs?: string;
  };
}

// Interface for generation options (enhanced)
interface GenerationOptions {
  headless?: boolean;
  timeout?: number;
  wantCsvLink?: boolean;
  validateConfigs?: boolean; // Whether to validate configs before sending to API
}

/**
 * Generate GCP Calculator URL using advanced browser automation
 * This function calls our API endpoint which uses Playwright to automate the GCP calculator
 * 
 * @param configs - Array of VM configurations to process
 * @param options - Generation options including headless mode, timeout, etc.
 * @returns Promise<string> - The shareable URL from GCP Calculator
 */
export async function generateGcpCalculatorUrl(
  configs: VmConfig[], 
  options: GenerationOptions = {}
): Promise<string> {
  try {
    console.log(`🤖 Generating GCP calculator URL for ${configs.length} configurations...`);
    
    // Validate configurations before sending to API if requested
    if (options.validateConfigs !== false) { // Default to true
      const validation = validateVmConfigsForAutomation(configs);
      if (!validation.isValid) {
        const errorDetails = validation.errors.map(err => 
          `${err.configName}: ${err.errors.join(', ')}`
        ).join('; ');
        throw new Error(`Configuration validation failed: ${errorDetails}`);
      }
    }
    
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        configurations: configs,
        options: {
          headless: options.headless !== false, // Default to headless
          timeout: options.timeout || 45000, // Increased default timeout for complex automation
          wantCsvLink: options.wantCsvLink || false,
        },
      }),
    });

    const data: GenerateUrlResponse = await response.json();

    if (!data.success) {
      const errorMessage = data.error || 'Failed to generate GCP calculator URL';
      const helpMessage = data.errorHelp || getAutomationErrorHelp(errorMessage);
      
      console.error('❌ API Error:', errorMessage);
      console.log('💡 Help:', helpMessage);
      
      throw new Error(`${errorMessage}${helpMessage ? ` (${helpMessage})` : ''}`);
    }

    if (!data.shareUrl) {
      throw new Error('No share URL returned from the service');
    }

    console.log(`✅ Successfully generated URL: ${data.shareUrl}`);
    console.log(`📊 Processed ${data.details?.configurationsProcessed} configurations`);
    
    // Log additional details if available
    if (data.details?.summary) {
      console.log(`💰 Total Cost: ${data.details.summary.totalCost || 'N/A'}`);
      console.log(`📋 Line Items: ${data.details.summary.lineItems?.length || 0}`);
    }
    
    // Log artifacts if available
    if (data.artifacts?.screenshots) {
      console.log('📸 Screenshots available:', Object.keys(data.artifacts.screenshots));
    }

    return data.shareUrl;

  } catch (error) {
    console.error('❌ Error generating GCP calculator URL:', error);
    
    // Don't return fallback URL anymore - let the caller handle the error
    throw error;
  }
}

/**
 * Generate individual URLs for each configuration
 * Note: This generates separate URLs for each config, which can be slow for large sets
 */
export async function generateIndividualUrls(
  configs: VmConfig[], 
  options: GenerationOptions = {}
): Promise<Array<{
  id: string;
  name: string;
  url: string;
  error?: string;
  artifacts?: {
    screenshots?: Record<string, string>;
    logs?: string;
  };
}>> {
  console.log(`🔗 Generating individual URLs for ${configs.length} configurations...`);
  
  // Process configs one by one to avoid overwhelming the system
  const results: Array<{
    id: string;
    name: string;
    url: string;
    error?: string;
    artifacts?: {
      screenshots?: Record<string, string>;
      logs?: string;
    };
  }> = [];
  
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    console.log(`📝 Processing config ${i + 1}/${configs.length}: ${config.name}`);
    
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configurations: [config],
          options: {
            headless: options.headless !== false,
            timeout: options.timeout || 45000,
            wantCsvLink: options.wantCsvLink || false,
          },
        }),
      });

      const data: GenerateUrlResponse = await response.json();

      if (data.success && data.shareUrl) {
        results.push({
          id: config.id,
          name: config.name || `Configuration ${i + 1}`,
          url: data.shareUrl,
          artifacts: data.artifacts ? {
            screenshots: data.artifacts.screenshots,
            logs: data.artifacts.logs
          } : undefined
        });
      } else {
        results.push({
          id: config.id,
          name: config.name || `Configuration ${i + 1}`,
          url: 'https://cloud.google.com/products/calculator',
          error: data.error || 'Unknown error',
          artifacts: data.artifacts ? {
            screenshots: data.artifacts.screenshots,
            logs: data.artifacts.logs
          } : undefined
        });
      }
    } catch (error) {
      results.push({
        id: config.id,
        name: config.name || `Configuration ${i + 1}`,
        url: 'https://cloud.google.com/products/calculator',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // Add a small delay between requests to be respectful
    if (i < configs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Generate a bulk URL containing all configurations
 */
export async function generateBulkUrl(
  configs: VmConfig[], 
  options: GenerationOptions = {}
): Promise<string> {
  return generateGcpCalculatorUrl(configs, options);
}

/**
 * Generate GCP Calculator URL with debug mode (non-headless browser)
 * Useful for development and debugging the automation process
 * 
 * @param configs - VM configurations to process
 * @param wantCsvLink - Whether to also get CSV download link
 * @returns Promise<string> - The shareable URL from GCP Calculator
 */
export async function generateGcpCalculatorUrlDebug(
  configs: VmConfig[], 
  wantCsvLink: boolean = false
): Promise<string> {
  console.log('🔍 DEBUG MODE: Running with visible browser for debugging...');
  console.log('⚠️ This will open a browser window. Close it manually after the process completes.');
  
  return generateGcpCalculatorUrl(configs, { 
    headless: false, 
    timeout: 120000, // Longer timeout for debugging
    wantCsvLink,
    validateConfigs: true
  });
}

/**
 * Test the automation with mock configurations
 * Runs in debug mode (visible browser) for easy troubleshooting
 */
export async function testAutomation(): Promise<void> {
  console.log('🧪 Testing automation with debug mode...');
  console.log('📝 Using a single mock configuration for testing...');
  
  try {
    const mockConfigs = getMockVmConfigs().slice(0, 1); // Just test with 1 config
    console.log('🔧 Test configuration:', mockConfigs[0]);
    
    const url = await generateGcpCalculatorUrlDebug(mockConfigs, true); // Also test CSV link
    console.log('✅ Test successful! Generated URL:', url);
    console.log('🎉 Automation is working correctly!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('💡 Tips for debugging:');
    console.log('  - Check the browser window that opened');
    console.log('  - Verify your internet connection');
    console.log('  - Check if GCP Calculator UI has changed');
    console.log('  - Look at the artifacts/logs for more details');
  }
}

/**
 * Check if the automation service is available
 */
export async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        configurations: [],
      }),
    });

    // Even if it returns an error for empty configs, it means the service is running
    return response.status !== 404;
  } catch {
    return false;
  }
}

// Legacy functions for backward compatibility
// These are kept to maintain existing functionality during the transition

/**
 * @deprecated Use generateGcpCalculatorUrl instead
 * This function is kept for backward compatibility
 */
export function openOfficialCalculatorForResearch(): void {
  console.log('🔬 Opening official GCP calculator for research...');
  if (typeof window !== 'undefined') {
    window.open('https://cloud.google.com/products/calculator', '_blank');
  }
}

/**
 * @deprecated This was used for URL analysis in the old approach
 * Now kept for reference and debugging purposes
 */
export function analyzeGcpUrl(url: string): void {
  console.log('🔍 Analyzing GCP Calculator URL (for reference):');
  console.log('Full URL:', url);
  
  try {
    const urlObj = new URL(url);
    console.log('Base URL:', urlObj.origin + urlObj.pathname);
    console.log('Query Parameters:', urlObj.searchParams.toString());
    console.log('Hash:', urlObj.hash);
  } catch (error) {
    console.error('Error analyzing URL:', error);
  }
}

/**
 * Test URL generation with provided configurations
 * Includes both bulk and individual URL generation testing
 */
export async function testUrlGeneration(configs: VmConfig[]): Promise<void> {
  console.log('🧪 Testing URL Generation with Advanced Browser Automation');
  console.log(`📊 Input configs: ${configs.length}`);
  
  try {
    // Test bulk URL generation first
    console.log('🔗 Testing bulk URL generation...');
    const bulkUrl = await generateBulkUrl(configs);
    console.log('✅ Bulk URL generated successfully:', bulkUrl);
    
    // Test individual URLs only for small sets to avoid overwhelming the system
    if (configs.length <= 3) {
      console.log('🔗 Testing individual URL generation...');
      const individualUrls = await generateIndividualUrls(configs);
      console.log('✅ Individual URLs generated successfully:');
      individualUrls.forEach((result, index) => {
        if (result.error) {
          console.log(`  ${index + 1}. ❌ ${result.name}: ${result.error}`);
        } else {
          console.log(`  ${index + 1}. ✅ ${result.name}: ${result.url}`);
        }
      });
    } else {
      console.log('⏭️ Skipping individual URL generation for large config set (>3 configs)');
      console.log('💡 For large sets, use bulk generation for better performance');
    }
    
    console.log('🎉 URL generation testing completed successfully!');
  } catch (error) {
    console.error('❌ URL generation test failed:', error);
    console.log('💡 Check the error details above and try with debug mode for more information');
  }
}

// Mock data function (unchanged)
export function getMockVmConfigs(): VmConfig[] {
  return [
    {
      id: '1',
      name: 'e2-standard-2',
      series: 'e2',
      family: 'General-purpose',
      description: '2 vCPUs 8 GB RAM',
      regionLocation: 'us-central1',
      vCpus: 2,
      cpuPlatform: 'Intel Cascade Lake',
      memoryGB: 8,
      isCustom: false,
      os: 'linux',
      sqlLicense: 'none',
      onDemandPerHour: 0.067123,
      cudOneYearPerHour: 0.04363,
      cudThreeYearPerHour: 0.030205,
      spotPerHour: 0.013425,
      runningHours: 730,
      quantity: 1,
      provisioningModel: 'regular',
      estimatedCost: 49,
      onDemandCost: 49,
      savings: 0,
    },
  ];
} 