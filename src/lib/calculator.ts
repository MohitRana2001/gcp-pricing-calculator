export interface VmConfig {
  id: string
  name: string // Machine type name (e.g., n2d-standard-64)
  series: string // Machine series (e.g., n2d)
  family: string // Machine family (e.g., General-purpose)
  description: string // Description (e.g., "64 vCPUs 256 GB RAM")
  regionLocation: string // Region (e.g., Mumbai, us-central1)
  vCpus: number
  cpuPlatform: string // CPU Platform (e.g., "AMD Milan, AMD Rome")
  memoryGB: number
  isCustom: boolean // For custom machine configurations
  os?: string // Operating System (optional)
  sqlLicense?: string // SQL License (optional)

  // Pricing structure (per hour rates)
  onDemandPerHour: number // On-demand per hour
  cudOneYearPerHour: number // Resource-based CUD - 1 year
  cudThreeYearPerHour: number // Resource-based CUD - 3 year
  spotPerHour: number // Per month Spot (converted to hourly)
  
  // Additional configuration
  runningHours: number // Hours per month
  quantity: number // Number of instances
  discountModel: string // Pricing model selection
  
  // Calculated costs
  estimatedCost: number
  onDemandCost: number
  savings: number
}

export interface CostCalculation {
  estimatedCost: number
  onDemandCost: number
  savings: number
}

export interface MachineTypeData {
  name: string;
  series: string;
  family: string;
  description: string;
  regionLocation: string;
  vCpus: number;
  cpuPlatform: string;
  memoryGB: number;
  onDemandPerHour: number;
  cudOneYearPerHour: number;
  cudThreeYearPerHour: number;
  spotPerHour: number;
  month: number;
  month1yCud: number;
  month3yCud: number;
  monthSles: number;
  monthSlesSap: number;
  monthSlesSap1yCud: number;
  monthSlesSap3yCud: number;
  monthRhel: number;
  monthRhel1yCud: number;
  monthRhel3yCud: number;
  monthRhelSap?: number; // Optional - may not exist in all data
  monthRhelSap1yCud?: number; // Optional - may not exist in all data
  monthRhelSap3yCud?: number; // Optional - may not exist in all data
  monthWindows: number;
}

// Machine series and families
export const MACHINE_SERIES = ['c4', 'c3', 'c3d', 'e2', 'n1', 'n2', 'n2d', 'n4', 'm1', 'm2', 'm3', 't2d']

export const MACHINE_FAMILIES: Record<string, string> = {
  'c4': 'Compute-optimized',
  'c3': 'Compute-optimized', 
  'c3d': 'Compute-optimized',
  'e2': 'General-purpose',
  'n1': 'General-purpose',
  'n2': 'General-purpose',
  'n2d': 'General-purpose',
  'n4': 'General-purpose',
  'm1': 'Memory-optimized',
  'm2': 'Memory-optimized',
  'm3': 'Memory-optimized',
  't2d': 'General-purpose'
}

// Available regions
export const REGIONS = [
  'us-central1',
  'us-east1', 
  'us-west1',
  'europe-west1',
  'europe-west4',
  'europe-north1',
  'asia-southeast1',
  'asia-east1',
  'asia-south1',
  'mumbai',
  'africa-south1'
]



// Discount models
export const DISCOUNT_MODELS = [
  'On-Demand',
  '1-Year CUD', 
  '3-Year CUD', 
  'Spot VM'
]

// Memory configuration for custom instances
export const MEMORY_CONFIGS: Record<string, { minMemoryPerVcpu: number; maxMemoryPerVcpu: number; supportsExtendedMemory: boolean }> = {
  'n2': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 8, supportsExtendedMemory: true },
  'n2d': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 8, supportsExtendedMemory: true },
  'n1': { minMemoryPerVcpu: 0.9, maxMemoryPerVcpu: 6.5, supportsExtendedMemory: true },
  'e2': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 8, supportsExtendedMemory: false },
  'c3': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 4, supportsExtendedMemory: false },
  'c3d': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 4, supportsExtendedMemory: false },
  'c4': { minMemoryPerVcpu: 1, maxMemoryPerVcpu: 2, supportsExtendedMemory: false },
  'm1': { minMemoryPerVcpu: 14.9, maxMemoryPerVcpu: 14.9, supportsExtendedMemory: false },
  'm2': { minMemoryPerVcpu: 11.7, maxMemoryPerVcpu: 11.7, supportsExtendedMemory: false },
  'm3': { minMemoryPerVcpu: 30.5, maxMemoryPerVcpu: 30.5, supportsExtendedMemory: false },
  't2d': { minMemoryPerVcpu: 1, maxMemoryPerVcpu: 4, supportsExtendedMemory: false }
}

// Check if a series supports extended/custom memory
export function seriesSupportsExtendedMemory(series: string): boolean {
  return MEMORY_CONFIGS[series]?.supportsExtendedMemory || false
}

// Get memory limits for a series
export function getMemoryLimits(series: string): { min: number; max: number } {
  const config = MEMORY_CONFIGS[series]
  if (!config) return { min: 1, max: 8 }
  return { 
    min: config.minMemoryPerVcpu, 
    max: config.maxMemoryPerVcpu 
  }
}

// Calculate allowed memory range for custom instances
export function getAllowedMemoryRange(series: string, vCpus: number): { min: number; max: number } {
  const limits = getMemoryLimits(series)
  return {
    min: Math.ceil(vCpus * limits.min),
    max: Math.floor(vCpus * limits.max)
  }
}

// Load machine types data (this would typically load from your JSON file)
let machineTypesData: MachineTypeData[] = []

export async function loadMachineTypesData(): Promise<void> {
  try {
    const response = await fetch('/data/machine-data.json');
    const data = await response.json();

    // Transform the data to match our interface
    machineTypesData = data.map((item: any) => ({
      name: item.name,
      series: item.series,
      family: MACHINE_FAMILIES[item.series] || 'General-purpose',
      description: `${item.vCpus} vCPUs ${item.memoryGB} GB RAM`,
      regionLocation: item.region,
      vCpus: item.vCpus,
      cpuPlatform: getCpuPlatform(item.series),
      memoryGB: item.memoryGB,
      onDemandPerHour: item.hour,
      cudOneYearPerHour: item.month1yCud / 730,
      cudThreeYearPerHour: item.month3yCud / 730,
      spotPerHour: item.hourSpot,
      month: item.month,
      month1yCud: item.month1yCud,
      month3yCud: item.month3yCud,
      monthSles: item.monthSles,
      monthSlesSap: item.monthSlesSap,
      monthSlesSap1yCud: item.monthSlesSap1yCud,
      monthSlesSap3yCud: item.monthSlesSap3yCud,
      monthRhel: item.monthRhel,
      monthRhel1yCud: item.monthRhel1yCud,
      monthRhel3yCud: item.monthRhel3yCud,
      monthRhelSap: item.monthRhelSap,
      monthRhelSap1yCud: item.monthRhelSap1yCud,
      monthRhelSap3yCud: item.monthRhelSap3yCud,
      monthWindows: item.monthWindows,
    }));
  } catch (error) {
    console.error('Failed to load machine types data:', error);
  }
}

export interface PricingDetails {
  onDemand: number;
  cud1y: number;
  cud3y: number;
  osOnDemand: number;
  os1yCud: number;
  os3yCud: number;
  sqlLicenseCost: number;
  onDemandInclusive: number;
  cud1yInclusive: number;
  cud3yInclusive: number;
}

export function getPricing(config: VmConfig): PricingDetails {
  const machine = machineTypesData.find(
    (m) => m.name === config.name && m.regionLocation === config.regionLocation
  );

  if (!machine) {
    return {
      onDemand: 0,
      cud1y: 0,
      cud3y: 0,
      osOnDemand: 0,
      os1yCud: 0,
      os3yCud: 0,
      sqlLicenseCost: 0,
      onDemandInclusive: 0,
      cud1yInclusive: 0,
      cud3yInclusive: 0,
    };
  }

  // Safely get base costs with fallbacks to prevent NaN
  const onDemand = (machine.onDemandPerHour || 0) * (config.runningHours || 730);
  const cud1y = machine.month1yCud || 0;
  const cud3y = machine.month3yCud || 0;

  let osOnDemand = 0;
  let os1yCud = 0;
  let os3yCud = 0;

  // Handle OS costs based on the optional os field
  const osType = config.os || 'linux'; // Default to Linux if not specified
  
  switch (osType.toLowerCase()) {
    case 'windows':
      osOnDemand = machine.monthWindows || 0;
      os1yCud = machine.monthWindows || 0;
      os3yCud = machine.monthWindows || 0;
      break;
    case 'rhel':
      osOnDemand = machine.monthRhel || 0;
      os1yCud = machine.monthRhel1yCud || 0;
      os3yCud = machine.monthRhel3yCud || 0;
      break;
    case 'rhel_sap':
      osOnDemand = machine.monthRhelSap || 0;
      os1yCud = machine.monthRhelSap1yCud || 0;
      os3yCud = machine.monthRhelSap3yCud || 0;
      break;
    case 'sles':
      osOnDemand = machine.monthSles || 0;
      os1yCud = machine.monthSlesSap1yCud || 0;
      os3yCud = machine.monthSlesSap3yCud || 0;
      break;
    case 'sles_sap':
      osOnDemand = machine.monthSlesSap || 0;
      os1yCud = machine.monthSlesSap1yCud || 0;
      os3yCud = machine.monthSlesSap3yCud || 0;
      break;
    case 'linux':
    default:
      // Linux is typically free, so no additional OS costs
      osOnDemand = 0;
      os1yCud = 0;
      os3yCud = 0;
      break;
  }

  // Handle SQL license costs (only for Windows)
  let sqlLicenseCost = 0;
  if (osType.toLowerCase() === 'windows' && config.sqlLicense) {
    const sqlCores = Math.max(4, config.vCpus || 0);
    const hours = config.runningHours || 730;
    
    switch (config.sqlLicense.toLowerCase()) {
      case 'enterprise':
        sqlLicenseCost = 0.399 * sqlCores * hours;
        break;
      case 'standard':
        sqlLicenseCost = 0.1200 * sqlCores * hours;
        break;
      case 'web':
        sqlLicenseCost = 0.011 * sqlCores * hours;
        break;
      default:
        sqlLicenseCost = 0;
        break;
    }
  }

  // Calculate inclusive costs safely
  const onDemandInclusive = (onDemand || 0) + (osOnDemand || 0) + (sqlLicenseCost || 0);
  const cud1yInclusive = (cud1y || 0) + (os1yCud || 0) + (sqlLicenseCost || 0);
  const cud3yInclusive = (cud3y || 0) + (os3yCud || 0) + (sqlLicenseCost || 0);

  return {
    onDemand: onDemand || 0,
    cud1y: cud1y || 0,
    cud3y: cud3y || 0,
    osOnDemand: osOnDemand || 0,
    os1yCud: os1yCud || 0,
    os3yCud: os3yCud || 0,
    sqlLicenseCost: sqlLicenseCost || 0,
    onDemandInclusive: onDemandInclusive || 0,
    cud1yInclusive: cud1yInclusive || 0,
    cud3yInclusive: cud3yInclusive || 0,
  };
}


// Get CPU platform based on series
function getCpuPlatform(series: string): string {
  const platforms: Record<string, string> = {
    'n2': 'Intel Cascade Lake',
    'n2d': 'AMD Milan, AMD Rome', 
    'n1': 'Intel Skylake, Intel Broadwell',
    'e2': 'Intel Cascade Lake',
    'c3': 'Intel Sapphire Rapids',
    'c3d': 'AMD Milan',
    'c4': 'Intel Sapphire Rapids',
    'm1': 'Intel Skylake',
    'm2': 'Intel Cascade Lake', 
    'm3': 'Intel Sapphire Rapids',
    't2d': 'AMD Milan'
  }
  return platforms[series] || 'Intel Cascade Lake'
}

// Get available machine types for a series and region
export function getAvailableMachineTypes(series: string, region: string): MachineTypeData[] {
  return machineTypesData.filter(machine => 
    machine.series === series && 
    machine.regionLocation === region
  )
}

// Get machine type specs
export function getMachineTypeSpecs(machineTypeName: string, region: string): MachineTypeData | null {
  return machineTypesData.find(machine => 
    machine.name === machineTypeName && 
    machine.regionLocation === region
  ) || null
}



// Initialize data loading
if (typeof window !== 'undefined') {
  loadMachineTypesData()
}