export interface VmConfig {
  id: string
  name: string // Machine type name (e.g., n2d-standard-64)
  series: string // Machine series (e.g., n2d)
  family: string // Machine family (e.g., General-purpose)
  description: string // Description (e.g., "64 vCPUs 256 GB RAM")
  regionLocation: string // Region (e.g., Mumbai, us-central1)
  vCpus: number
  cpuPlatform: string // CPU Platform (e.g., "AMD Milan, AMD Rome")
  memoryGB: number;
  isCustom: boolean; // For custom machine configurations

  // Pricing structure (per hour rates)
  onDemandPerHour: number; // On-demand per hour
  cudOneYearPerHour: number; // Resource-based CUD - 1 year
  cudThreeYearPerHour: number // Resource-based CUD - 3 year
  spotPerHour: number // Per month Spot (converted to hourly)
  
  // Additional configuration
  runningHours: number // Hours per month
  quantity: number // Number of instances
  discountModel: string // Pricing model selection
  
  // Disk configuration
  diskType: string
  diskSize: number
  
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

// Disk types and pricing (per GB per month)
export const DISK_PRICING: Record<string, number> = {
  'Standard': 0.04,
  'Balanced': 0.10,
  'SSD': 0.17,
}

export const DISK_TYPES = ['Standard', 'Balanced', 'SSD']

// Discount models


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
  winOrRhelLics: number;
  rhelLics1yCud: number;
  rhelLics3yCud: number;
  sqlStdLics: number;
  sqlEeLics: number;
  onDemandAllInclusive: number;
  cud1yAllInclusive: number;
  cud3yAllInclusive: number;
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
      winOrRhelLics: 0,
      rhelLics1yCud: 0,
      rhelLics3yCud: 0,
      sqlStdLics: 0,
      sqlEeLics: 0,
      onDemandAllInclusive: 0,
      cud1yAllInclusive: 0,
      cud3yAllInclusive: 0,
    };
  }

  const onDemand = machine.month;
  const cud1y = machine.month1yCud;
  const cud3y = machine.month3yCud;

  const winOrRhelLics = machine.monthWindows || machine.monthRhel;
  const rhelLics1yCud = machine.monthRhel1yCud;
  const rhelLics3yCud = machine.monthRhel3yCud;

  const sqlCores = Math.max(4, config.vCpus);
  const sqlStdLics = 0.1200 * sqlCores * config.runningHours;
  const sqlEeLics = 0.399 * sqlCores * config.runningHours;

  const onDemandAllInclusive = onDemand + winOrRhelLics + sqlStdLics;
  const cud1yAllInclusive = cud1y + rhelLics1yCud + sqlStdLics;
  const cud3yAllInclusive = cud3y + rhelLics3yCud + sqlStdLics;

  return {
    onDemand,
    cud1y,
    cud3y,
    winOrRhelLics,
    rhelLics1yCud,
    rhelLics3yCud,
    sqlStdLics,
    sqlEeLics,
    onDemandAllInclusive,
    cud1yAllInclusive,
    cud3yAllInclusive,
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
 