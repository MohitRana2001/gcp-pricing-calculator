import { NextRequest, NextResponse } from 'next/server';
import { VmConfig } from '@/lib/calculator';
import { runGcpCalculatorAutomation, EstimateRequest, OutputJSON } from '@/lib/gcpCalculatorAutomation';
import { vmConfigsToEstimateRequest, validateVmConfigsForAutomation, getAutomationErrorHelp } from '@/lib/gcpConfigAdapter';

// Interface for the API request
interface GenerateUrlRequest {
  configurations: VmConfig[];
  commitment: 'none' | '1 year' | '3 years'; // New field for specific commitment
  parallel?: boolean; // New field for parallel generation
  options?: {
    headless?: boolean;
    timeout?: number;
    wantCsvLink?: boolean;
    debug?: boolean; // Add debug mode
  };
}

// Interface for the API response
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log(`🚀 API STEP 1: POST request received at /api/generate-gcp-url`);
    console.log(`📝 API STEP 1.1: Request headers:`, Object.fromEntries(request.headers.entries()));
    
    const body: GenerateUrlRequest = await request.json();
    console.log(`📋 API STEP 2: Request body parsed successfully`);
    console.log(`📋 API STEP 2.1: Raw body:`, JSON.stringify(body, null, 2));
    
    const { configurations = [], commitment = 'none', parallel = false, options = {} } = body;
    console.log(`📊 API STEP 2.2: Extracted ${configurations.length} configurations, commitment: ${commitment}, parallel: ${parallel}, and options:`, options);

    // Environment diagnostics for VM debugging
    console.log(`🔍 ENV DIAGNOSTICS: Node version: ${process.version}`);
    console.log(`🔍 ENV DIAGNOSTICS: Platform: ${process.platform}`);
    console.log(`🔍 ENV DIAGNOSTICS: Architecture: ${process.arch}`);
    console.log(`🔍 ENV DIAGNOSTICS: Memory usage:`, process.memoryUsage());
    console.log(`🔍 ENV DIAGNOSTICS: Environment variables:`, {
      NODE_ENV: process.env.NODE_ENV,
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD,
      DISPLAY: process.env.DISPLAY,
      CHROME_BIN: process.env.CHROME_BIN,
    });

    console.log(`🤖 API STEP 3: Starting GCP Calculator automation for ${configurations.length} configurations`);

    // Validate configurations
    const validation = validateVmConfigsForAutomation(configurations);
    if (!validation.isValid) {
      const errorMessages = validation.errors.map(err => 
        `${err.configName}: ${err.errors.join(', ')}`
      ).join('; ');
      
      return NextResponse.json<GenerateUrlResponse>({
        success: false,
        error: `Configuration validation failed: ${errorMessages}`,
        errorHelp: 'Please check that all configurations have valid machine types, regions, and other required fields.'
      }, { status: 400 });
    }

    // Convert VmConfigs to EstimateRequest format with enhanced VM options
    const estimateRequest = vmConfigsToEstimateRequest(configurations, {
      headless: options.headless !== false, // Default to true for VM environments
      timeoutMs: options.timeout || 60000, // Increase timeout for VM environments
      service: 'Compute Engine',
      wantCsvLink: options.wantCsvLink || false,
      commitment: commitment, // Pass down the specific commitment
      debug: options.debug || false,
    });

    // Run the advanced Playwright automation with VM-optimized settings
    console.log('🎭 Running advanced Playwright automation...');
    const result: OutputJSON = await runGcpCalculatorAutomation({
      ...estimateRequest,
      collectArtifacts: options.debug || false, // Collect artifacts in debug mode
      vmOptimized: true, // Flag for VM-specific optimizations
    });

    if (!result.success) {
      const errorHelp = getAutomationErrorHelp(result.error || '');
      
      return NextResponse.json<GenerateUrlResponse>({
        success: false,
        error: result.error || 'Unknown automation error',
        errorHelp,
        artifacts: {
          screenshots: result.artifacts?.screenshots,
          logs: result.artifacts?.consoleLogs
        }
      }, { status: 500 });
    }

    // Transform the result to match our API response format
    const response: GenerateUrlResponse = {
      success: true,
      shareUrl: result.shareUrl!,
      csvDownloadUrl: result.csvDownloadUrl,
      details: {
        configurationsProcessed: configurations.length,
        timestamp: new Date().toISOString(),
        summary: result.estimateSummary ? {
          totalCost: result.estimateSummary.totalText || undefined,
          lineItems: result.estimateSummary.lineItems?.map(item => ({
            service: item.service,
            region: item.region,
            machineType: item.machineType,
            instances: item.instances,
            subtotal: item.subtotalText || undefined
          }))
        } : undefined
      },
      artifacts: {
        screenshots: result.artifacts?.screenshots,
        logs: result.artifacts?.consoleLogs
      }
    };

    console.log(`✅ Successfully generated GCP calculator URL: ${result.shareUrl}`);
    console.log(`📊 Processed ${configurations.length} configurations`);
    
    return NextResponse.json<GenerateUrlResponse>(response);

  } catch (error) {
    console.error('❌ Error in GCP URL generation:', error);
    
    const errorHelp = getAutomationErrorHelp(error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json<GenerateUrlResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorHelp
    }, { status: 500 });
  }
}