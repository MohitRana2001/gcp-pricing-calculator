import { NextRequest, NextResponse } from 'next/server';
import { VmConfig } from '@/lib/calculator';
import { runGcpCalculatorAutomation, EstimateRequest, OutputJSON } from '@/lib/gcpCalculatorAutomation';
import { vmConfigsToEstimateRequest, validateVmConfigsForAutomation, getAutomationErrorHelp } from '@/lib/gcpConfigAdapter';

// Interface for the API request (updated to accept real VM configurations)
interface GenerateUrlRequest {
  configurations: VmConfig[]; // Array of VM configurations from spreadsheet
  options?: {
    headless?: boolean;
    timeout?: number;
    wantCsvLink?: boolean;
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
    const body: GenerateUrlRequest = await request.json();
    const { configurations = [], options = {} } = body;

    console.log(`🤖 Starting GCP Calculator automation for ${configurations.length} configurations`);

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

    // Convert VmConfigs to EstimateRequest format
    const estimateRequest = vmConfigsToEstimateRequest(configurations, {
      headless: options.headless,
      timeoutMs: options.timeout,
      service: 'Compute Engine',
      wantCsvLink: options.wantCsvLink || false
    });

    // Run the advanced Playwright automation
    console.log('🎭 Running advanced Playwright automation...');
    const result: OutputJSON = await runGcpCalculatorAutomation({
      ...estimateRequest,
      collectArtifacts: false, // do not store artifacts in production per requirement
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
