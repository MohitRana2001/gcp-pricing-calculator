// Adapter functions to convert between VmConfig and InstanceInput formats
// This bridges the gap between our internal data structure and the Playwright automation script

import { VmConfig } from './calculator';
import { InstanceInput, EstimateRequest } from './gcpCalculatorAutomation';

/**
 * Maps discount model names from our internal format to GCP Calculator format
 */
function mapDiscountModelToCommittedUse(discountModel: string): 'none' | '1 year' | '3 years' {
  switch (discountModel.toLowerCase()) {
    case '1-year cud':
    case '1 year cud':
    case '1-year':
    case '1 year':
      return '1 year';
    case '3-year cud':
    case '3 year cud':
    case '3-year':
    case '3 years':
      return '3 years';
    case 'on-demand':
    case 'spot vm':
    case 'none':
    default:
      return 'none';
  }
}

/**
 * Maps our internal discount model to provisioning model
 * Now supports both explicit provisioningModel field and legacy discountModel inference
 */
function mapDiscountModelToProvisioningModel(config: VmConfig): string {
  // Check if explicit provisioning model is set (new approach)
  if (config.provisioningModel) {
    return config.provisioningModel;
  }
  
  // Fallback to legacy inference from discount model
  if (config.provisioningModel.toLowerCase().includes('spot')) {
    return 'spot';
  }
  return 'regular';
}

/**
 * Maps our internal OS format to GCP Calculator format
 */
function mapOperatingSystem(os?: string): string {
  if (!os) return 'Linux';
  
  switch (os.toLowerCase()) {
    case 'linux':
      return 'Linux';
    case 'windows':
      return 'Windows';
    case 'rhel':
      return 'Red Hat Enterprise Linux';
    case 'rhel_sap':
      return 'Red Hat Enterprise Linux for SAP';
    case 'sles':
      return 'SUSE Linux Enterprise Server';
    case 'sles_sap':
      return 'SUSE Linux Enterprise Server for SAP';
    default:
      return 'Linux';
  }
}

/**
 * Maps our internal region format to GCP Calculator region format
 */
function mapRegion(regionLocation: string): string {
  // Region mapping from our internal format to GCP Calculator display names
  const regionMap: Record<string, string> = {
    'us-central1': 'Iowa (us-central1)',
    'us-east1': 'South Carolina (us-east1)',
    'us-west1': 'Oregon (us-west1)',
    'us-west2': 'Los Angeles (us-west2)',
    'us-west3': 'Salt Lake City (us-west3)',
    'us-west4': 'Las Vegas (us-west4)',
    'us-east4': 'Northern Virginia (us-east4)',
    'us-south1': 'Dallas (us-south1)',
    'europe-west1': 'Belgium (europe-west1)',
    'europe-west2': 'London (europe-west2)',
    'europe-west3': 'Frankfurt (europe-west3)',
    'europe-west4': 'Netherlands (europe-west4)',
    'europe-west6': 'Zurich (europe-west6)',
    'europe-central2': 'Warsaw (europe-central2)',
    'europe-north1': 'Finland (europe-north1)',
    'asia-east1': 'Taiwan (asia-east1)',
    'asia-east2': 'Hong Kong (asia-east2)',
    'asia-northeast1': 'Tokyo (asia-northeast1)',
    'asia-northeast2': 'Osaka (asia-northeast2)',
    'asia-northeast3': 'Seoul (asia-northeast3)',
    'asia-south1': 'Mumbai (asia-south1)',
    'asia-south2': 'Delhi (asia-south2)',
    'asia-southeast1': 'Singapore (asia-southeast1)',
    'asia-southeast2': 'Jakarta (asia-southeast2)',
    'australia-southeast1': 'Sydney (australia-southeast1)',
    'australia-southeast2': 'Melbourne (australia-southeast2)',
    'southamerica-east1': 'São Paulo (southamerica-east1)',
    'southamerica-west1': 'Santiago (southamerica-west1)',
    'northamerica-northeast1': 'Montréal (northamerica-northeast1)',
    'northamerica-northeast2': 'Toronto (northamerica-northeast2)',
    'africa-south1': 'Johannesburg (africa-south1)',
    'mumbai': 'Mumbai (asia-south1)', // Handle legacy mapping
  };

  // Return mapped region or try to find a partial match
  const mappedRegion = regionMap[regionLocation];
  if (mappedRegion) {
    return mappedRegion;
  }

  // If no exact match, try partial matching
  const partialMatch = Object.entries(regionMap).find(([key, value]) => 
    key.includes(regionLocation) || value.toLowerCase().includes(regionLocation.toLowerCase())
  );

  if (partialMatch) {
    return partialMatch[1];
  }

  // If no match found, return the original with a fallback format
  return regionLocation.includes('(') ? regionLocation : `${regionLocation} (${regionLocation})`;
}

/**
 * Maps our machine series to proper case format expected by GCP Calculator
 */
function mapMachineSeries(series: string): string {
  return series.toUpperCase(); // GCP Calculator expects uppercase series names (E2, N2, etc.)
}

/**
 * Converts a single VmConfig to InstanceInput format
 */
export function vmConfigToInstanceInput(config: VmConfig): InstanceInput {
  return {
    numberOfInstances: config.quantity || 1,
    totalHours: config.runningHours || 730, // Default to full month if not specified
    operatingSystem: mapOperatingSystem(config.os),
    provisioningModel: mapDiscountModelToProvisioningModel(config), // Now passes full config
    series: mapMachineSeries(config.series),
    machineType: config.name, // e.g., e2-standard-4
    region: mapRegion(config.regionLocation),
    committedUse: mapDiscountModelToCommittedUse(config.discountModel),
  };
}

/**
 * Converts multiple VmConfigs to an EstimateRequest
 */
export function vmConfigsToEstimateRequest(
  configs: VmConfig[],
  options: {
    headless?: boolean;
    timeoutMs?: number;
    service?: string;
    wantCsvLink?: boolean;
  } = {}
): EstimateRequest {
  return {
    headless: options.headless !== false, // Default to headless
    timeoutMs: options.timeoutMs || 45000, // Default 45 second timeout
    service: options.service || 'Compute Engine', // Default service
    instances: configs.map(vmConfigToInstanceInput),
    wantCsvLink: options.wantCsvLink || false,
  };
}

/**
 * Validates that a VmConfig has all required fields for automation
 */
export function validateVmConfigForAutomation(config: VmConfig): string[] {
  const errors: string[] = [];

  if (!config.name || config.name.trim() === '') {
    errors.push('Machine type name is required');
  }

  if (!config.series || config.series.trim() === '') {
    errors.push('Machine series is required');
  }

  if (!config.regionLocation || config.regionLocation.trim() === '') {
    errors.push('Region location is required');
  }

  if (!config.discountModel || config.discountModel.trim() === '') {
    errors.push('Discount model is required');
  }

  if (typeof config.quantity !== 'number' || config.quantity < 1) {
    errors.push('Quantity must be a positive number');
  }

  if (typeof config.runningHours !== 'number' || config.runningHours < 1 || config.runningHours > 744) {
    errors.push('Running hours must be between 1 and 744 (max hours per month)');
  }

  return errors;
}

/**
 * Validates multiple VmConfigs for automation
 */
export function validateVmConfigsForAutomation(configs: VmConfig[]): {
  isValid: boolean;
  errors: Array<{ configId: string; configName: string; errors: string[] }>;
} {
  if (!configs || configs.length === 0) {
    return {
      isValid: false,
      errors: [{ configId: '', configName: 'General', errors: ['At least one configuration is required'] }]
    };
  }

  const configErrors = configs.map(config => ({
    configId: config.id,
    configName: config.name || 'Unnamed Configuration',
    errors: validateVmConfigForAutomation(config)
  })).filter(result => result.errors.length > 0);

  return {
    isValid: configErrors.length === 0,
    errors: configErrors
  };
}

/**
 * Helper function to create a test configuration for automation testing
 */
export function createTestVmConfig(): VmConfig {
  return {
    id: 'test-1',
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
  };
}

/**
 * Helper function to get user-friendly error messages for common automation issues
 */
export function getAutomationErrorHelp(error: string): string {
  const errorHelpMap: Record<string, string> = {
    'Failed to click Add to estimate': 'The GCP Calculator page may have changed. Try refreshing and trying again.',
    'Failed to click Service card': 'Could not find the Compute Engine service. Make sure the GCP Calculator is accessible.',
    'Option not found in dropdown': 'The specified option was not found in the dropdown. Check that the machine type, region, or other options are valid.',
    'Failed to capture share URL': 'Could not get the shareable URL. The sharing functionality may have changed.',
    'Total not found': 'Could not find the total cost on the page. The calculation may not have completed.',
  };

  for (const [errorPattern, help] of Object.entries(errorHelpMap)) {
    if (error.includes(errorPattern)) {
      return help;
    }
  }

  return 'An unexpected error occurred during automation. Please check the console logs for more details.';
}
