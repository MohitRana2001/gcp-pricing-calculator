// GCP Pricing Calculator URL Generator (Playwright-based)
// Uses browser automation to interact with the official Google Cloud Pricing Calculator

import { VmConfig } from './calculator';

// Base URL for the API endpoint
const API_BASE_URL = '/api/generate-gcp-url';

// Interface for API response
interface GenerateUrlResponse {
  success: boolean;
  shareUrl?: string;
  error?: string;
  details?: {
    configurationsProcessed: number;
    timestamp: string;
  };
}

// Interface for generation options
interface GenerationOptions {
  headless?: boolean;
  timeout?: number;
}

/**
 * Generate GCP Calculator URL using browser automation
 * This function calls our API endpoint which uses Playwright to automate the GCP calculator
 */
export async function generateGcpCalculatorUrl(
  configs: VmConfig[], 
  options: GenerationOptions = {}
): Promise<string> {
  try {
    console.log(`🤖 Generating GCP calculator URL for ${configs.length} configurations...`);
    
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        configurations: configs,
        options: {
          headless: options.headless !== false, // Default to headless
          timeout: options.timeout || 30000,
        },
      }),
    });

    const data: GenerateUrlResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to generate GCP calculator URL');
    }

    if (!data.shareUrl) {
      throw new Error('No share URL returned from the service');
    }

    console.log(`✅ Successfully generated URL: ${data.shareUrl}`);
    console.log(`📊 Processed ${data.details?.configurationsProcessed} configurations`);

    return data.shareUrl;

  } catch (error) {
    console.error('❌ Error generating GCP calculator URL:', error);
    
    // Return a fallback URL with a descriptive message
    const fallbackUrl = `https://cloud.google.com/products/calculator?utm_source=custom_calculator&configs=${configs.length}`;
    console.log(`🔄 Returning fallback URL: ${fallbackUrl}`);
    
    throw error; // Re-throw to let the caller handle it
  }
}

/**
 * Generate individual URLs for each configuration
 */
export async function generateIndividualUrls(
  configs: VmConfig[], 
  options: GenerationOptions = {}
): Promise<Array<{
  id: string;
  name: string;
  url: string;
  error?: string;
}>> {
  console.log(`🔗 Generating individual URLs for ${configs.length} configurations...`);
  
  const results = await Promise.allSettled(
    configs.map(async (config, index) => {
      try {
        const url = await generateGcpCalculatorUrl([config], options);
        return {
          id: config.id,
          name: config.name || `Configuration ${index + 1}`,
          url,
        };
      } catch (error) {
        return {
          id: config.id,
          name: config.name || `Configuration ${index + 1}`,
          url: 'https://cloud.google.com/products/calculator',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        id: configs[index].id,
        name: configs[index].name || `Configuration ${index + 1}`,
        url: 'https://cloud.google.com/products/calculator',
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
    }
  });
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
 */
export async function generateGcpCalculatorUrlDebug(configs: VmConfig[]): Promise<string> {
  console.log('🔍 DEBUG MODE: Running with visible browser for debugging...');
  return generateGcpCalculatorUrl(configs, { headless: false, timeout: 60000 });
}

/**
 * Test the automation with mock configurations
 */
export async function testAutomation(): Promise<void> {
  console.log('🧪 Testing automation with debug mode...');
  try {
    const mockConfigs = getMockVmConfigs().slice(0, 1); // Just test with 1 config
    const url = await generateGcpCalculatorUrlDebug(mockConfigs);
    console.log('✅ Test successful! Generated URL:', url);
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('💡 Check the browser window that opened to see what happened');
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
 * Test URL generation with mock data
 */
export async function testUrlGeneration(configs: VmConfig[]): Promise<void> {
  console.log('🧪 Testing URL Generation with Browser Automation');
  console.log('Input configs:', configs.length);
  
  try {
    const bulkUrl = await generateBulkUrl(configs);
    console.log('✅ Bulk URL generated successfully:', bulkUrl);
    
    if (configs.length <= 3) { // Only test individual URLs for small sets
      const individualUrls = await generateIndividualUrls(configs);
      console.log('✅ Individual URLs generated successfully:', individualUrls);
    } else {
      console.log('⏭️ Skipping individual URL generation for large config set');
    }
  } catch (error) {
    console.error('❌ URL generation test failed:', error);
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
      discountModel: 'On-Demand',
      estimatedCost: 49,
      onDemandCost: 49,
      savings: 0,
    },
  ];
} 