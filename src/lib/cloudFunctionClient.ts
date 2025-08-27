// Cloud Function Client for GCP Calculator Automation
// This client handles communication with the Cloud Function

import { VmConfig } from './calculator';

// Cloud Function configuration
const CLOUD_FUNCTION_URL = process.env.GCP_CALCULATOR_FUNCTION_URL || 'https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/gcp-calculator-automation';
const CLOUD_FUNCTION_TIMEOUT = 600000; // 10 minutes

// Types for Cloud Function communication
export interface CloudFunctionRequest {
  service: string;
  timeoutMs?: number;
  wantCsvLink?: boolean;
  instances: Array<{
    numberOfInstances: number;
    totalHours: number;
    operatingSystem: string;
    provisioningModel: string;
    series: string;
    machineType: string;
    region: string;
    committedUse: 'none' | '1 year' | '3 years';
    isCustom: boolean;
    vCpus?: number;
    memoryGB?: number;
  }>;
}

export interface CloudFunctionResponse {
  success: boolean;
  shareUrl?: string;
  csvDownloadUrl?: string | null;
  error?: string;
  estimateSummary?: {
    totalText?: string;
    lineItems?: Array<{
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
  };
}

// Helper function to get authentication token
async function getAuthToken(): Promise<string | null> {
  // In production, this should use service account credentials
  // For now, we'll use environment variable or return null for unauthenticated calls
  
  if (process.env.GCP_ACCESS_TOKEN) {
    return process.env.GCP_ACCESS_TOKEN;
  }
  
  // If running on GCP, try to get token from metadata server
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      const authClient = await auth.getClient();
      const token = await authClient.getAccessToken();
      return token.token;
    } catch (error) {
      console.warn('⚠️ Could not get GCP auth token:', error);
      return null;
    }
  }
  
  return null;
}

// Convert VmConfig to Cloud Function instance format
function vmConfigToCloudFunctionInstance(config: VmConfig, commitment: 'none' | '1 year' | '3 years') {
  return {
    numberOfInstances: config.quantity || 1,
    totalHours: config.runningHours || 730,
    operatingSystem: config.os === 'linux' ? 'linux' : config.os === 'windows' ? 'windows' : 'linux',
    provisioningModel: config.provisioningModel === 'spot' ? 'spot' : 'regular',
    series: config.series,
    machineType: config.name,
    region: config.regionLocation,
    committedUse: commitment,
    isCustom: config.isCustom || false,
    vCpus: config.vCpus,
    memoryGB: config.memoryGB
  };
}

// Main function to call the Cloud Function
export async function callGcpCalculatorCloudFunction(
  configurations: VmConfig[],
  commitment: 'none' | '1 year' | '3 years',
  options: {
    wantCsvLink?: boolean;
    timeout?: number;
    debug?: boolean;
  } = {}
): Promise<CloudFunctionResponse> {
  console.log(`🌐 Calling Cloud Function for ${configurations.length} configurations with commitment: ${commitment}`);
  
  try {
    // Prepare request payload
    const requestPayload: CloudFunctionRequest = {
      service: 'Compute Engine',
      timeoutMs: options.timeout || 60000,
      wantCsvLink: options.wantCsvLink || false,
      instances: configurations.map(config => vmConfigToCloudFunctionInstance(config, commitment))
    };

    console.log(`📤 Request payload:`, JSON.stringify(requestPayload, null, 2));

    // Get authentication token
    const authToken = await getAuthToken();
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      console.log('🔐 Using authenticated request');
    } else {
      console.log('⚠️ Making unauthenticated request (may fail if function requires auth)');
    }

    // Call the Cloud Function
    console.log(`🚀 Calling Cloud Function: ${CLOUD_FUNCTION_URL}`);
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(CLOUD_FUNCTION_TIMEOUT)
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Cloud Function error: ${response.status} ${response.statusText}`, errorText);
      
      throw new Error(`Cloud Function call failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const result: CloudFunctionResponse = await response.json();
    console.log(`📊 Cloud Function response:`, result);

    if (!result.success) {
      throw new Error(result.error || 'Cloud Function returned failure');
    }

    return result;

  } catch (error) {
    console.error('❌ Error calling Cloud Function:', error);
    
    // Enhanced error messages
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('Cloud Function timeout - the automation is taking too long. Please try again or reduce the number of configurations.');
      } else if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error('Authentication failed - please check your GCP credentials and permissions.');
      } else if (error.message.includes('404')) {
        throw new Error('Cloud Function not found - please check the function URL and ensure it is deployed.');
      } else if (error.message.includes('503') || error.message.includes('502')) {
        throw new Error('Cloud Function is temporarily unavailable - please try again in a few moments.');
      }
    }
    
    throw error;
  }
}

// Batch function to call Cloud Function for multiple commitment types in parallel
export async function callCloudFunctionForAllCommitments(
  configurations: VmConfig[],
  options: {
    wantCsvLink?: boolean;
    timeout?: number;
    debug?: boolean;
  } = {}
): Promise<{
  onDemand?: CloudFunctionResponse;
  oneYear?: CloudFunctionResponse;
  threeYear?: CloudFunctionResponse;
  errors: Record<string, string>;
}> {
  console.log(`🔗 Calling Cloud Function for all commitment types in parallel`);
  
  const commitmentTypes: Array<'none' | '1 year' | '3 years'> = ['none', '1 year', '3 years'];
  const results: Record<string, CloudFunctionResponse> = {};
  const errors: Record<string, string> = {};

  // Run all commitment types in parallel
  const promises = commitmentTypes.map(async (commitment) => {
    try {
      const result = await callGcpCalculatorCloudFunction(configurations, commitment, options);
      return { commitment, result, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { commitment, error: errorMessage, success: false };
    }
  });

  const responses = await Promise.all(promises);

  // Process results
  responses.forEach(response => {
    if (response.success && 'result' in response) {
      const key = response.commitment === 'none' ? 'onDemand' : 
                  response.commitment === '1 year' ? 'oneYear' : 'threeYear';
      results[key] = response.result;
    } else if ('error' in response) {
      errors[response.commitment] = response.error;
    }
  });

  return {
    ...results,
    errors
  } as any;
}

// Health check function
export async function checkCloudFunctionHealth(): Promise<boolean> {
  try {
    console.log('🏥 Checking Cloud Function health...');
    
    const authToken = await getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Send minimal test request
    const testPayload = {
      service: 'Compute Engine',
      instances: []
    };

    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000) // 10 second timeout for health check
    });

    // Even if it returns an error for empty instances, it means the function is running
    return response.status !== 404;
    
  } catch (error) {
    console.error('❌ Cloud Function health check failed:', error);
    return false;
  }
}

// Configuration helper
export function configureCloudFunction(functionUrl: string) {
  // This would update the CLOUD_FUNCTION_URL at runtime
  // For now, it's mainly for documentation
  console.log(`🔧 Cloud Function URL configured: ${functionUrl}`);
  console.log('💡 To use a different URL, set the GCP_CALCULATOR_FUNCTION_URL environment variable');
}
