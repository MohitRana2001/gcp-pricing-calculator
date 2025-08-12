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
  os: string // Operating System
  sqlLicense: string // SQL License
  provisioningModel: string // 'regular' or 'spot'

  // Pricing structure (per hour rates)
  onDemandPerHour: number // On-demand per hour
  cudOneYearPerHour: number // Resource-based CUD - 1 year
  cudThreeYearPerHour: number // Resource-based CUD - 3 year
  spotPerHour: number // Per month Spot (converted to hourly)

  // Additional configuration
  runningHours: number // Hours per month
  quantity: number // Number of instances
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



// Discount models with enhanced provisioning options
export const DISCOUNT_MODELS = [
  'On-Demand',
  '1-Year CUD', 
  '3-Year CUD', 
  'Spot VM'
]

// Provisioning models (separate from discount models)
export const PROVISIONING_MODELS = [
  'Regular',
  'Spot'
] as const

export type ProvisioningModel = typeof PROVISIONING_MODELS[number]

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

function getUbuntuProCost(vCpus: number, memoryGB: number, runningHours: number): number {
    let vcpuCostPerHour = 0;
    if (vCpus === 1) vcpuCostPerHour = 0.00166;
    else if (vCpus === 2) vcpuCostPerHour = 0.002971;
    else if (vCpus === 4) vcpuCostPerHour = 0.005545;
    else if (vCpus >= 6 && vCpus <= 8) vcpuCostPerHour = 0.00997;
    else if (vCpus >= 10 && vCpus <= 16) vcpuCostPerHour = 0.018063;
    else if (vCpus >= 18 && vCpus <= 48) vcpuCostPerHour = 0.033378;
    else if (vCpus >= 50 && vCpus <= 78) vcpuCostPerHour = 0.060548;
    else if (vCpus >= 80 && vCpus <= 96) vcpuCostPerHour = 0.077871;
    else if (vCpus >= 98 && vCpus <= 222) vcpuCostPerHour = 0.102401;
    else if (vCpus > 222) vcpuCostPerHour = 0.122063;

    const ramCostPerHour = 0.000127 * memoryGB;
    const totalHourlyCost = vcpuCostPerHour + ramCostPerHour;
    return totalHourlyCost * runningHours;
}

function getRhel7ElsCost(vCpus: number, runningHours: number): number {
    let vcpuCostPerHour = 0;
    if (vCpus >= 1 && vCpus <= 8) vcpuCostPerHour = 0.0084;
    else if (vCpus >= 9 && vCpus <= 127) vcpuCostPerHour = 0.0060;
    else if (vCpus >= 128) vcpuCostPerHour = 0.0050;

    return vcpuCostPerHour * vCpus * runningHours;
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

  let onDemand = (Number(machine.onDemandPerHour) || 0) * config.runningHours;
  let cud1y = Number(machine.month1yCud) || 0;
  let cud3y = Number(machine.month3yCud) || 0;

  if (config.provisioningModel === 'spot') {
    onDemand = (Number(machine.spotPerHour) || 0) * config.runningHours;
    cud1y = 0; // No CUDs for Spot VM compute
    cud3y = 0; // No CUDs for Spot VM compute
  }

  let osOnDemand = 0;
  let os1yCud = 0;
  let os3yCud = 0;

  switch (config.os) {
    case 'windows':
      osOnDemand = Number(machine.monthWindows) || 0;
      os1yCud = Number(machine.monthWindows) || 0;
      os3yCud = Number(machine.monthWindows) || 0;
      break;
    case 'rhel':
      osOnDemand = Number(machine.monthRhel) || 0;
      os1yCud = Number(machine.monthRhel1yCud) || 0;
      os3yCud = Number(machine.monthRhel3yCud) || 0;
      break;
    case 'rhel_sap':
        osOnDemand = Number(machine?.monthRhelSap) || 0;
        os1yCud = Number(machine?.monthRhelSap1yCud) || 0;
        os3yCud = Number(machine?.monthRhelSap3yCud) || 0;
        break;
    case 'sles':
      osOnDemand = Number(machine.monthSles) || 0;
      os1yCud = Number(machine.monthSlesSap1yCud) || 0;
      os3yCud = Number(machine.monthSlesSap3yCud) || 0;
      break;
    case 'sles_sap':
        osOnDemand = Number(machine.monthSlesSap) || 0;
        os1yCud = Number(machine.monthSlesSap1yCud) || 0;
        os3yCud = Number(machine.monthSlesSap3yCud) || 0;
        break;
    case 'ubuntu_pro':
        const ubuntuCost = getUbuntuProCost(config.vCpus, config.memoryGB, config.runningHours);
        osOnDemand = ubuntuCost;
        os1yCud = ubuntuCost; // Assuming same price for CUD
        os3yCud = ubuntuCost; // Assuming same price for CUD
        break;
    case 'rhel_7_els':
        const rhel7ElsCost = getRhel7ElsCost(config.vCpus, config.runningHours);
        osOnDemand = rhel7ElsCost;
        os1yCud = rhel7ElsCost; // Assuming same price for CUD
        os3yCud = rhel7ElsCost; // Assuming same price for CUD
        break;
  }

  let sqlLicenseCost = 0;
  if (config.os === 'windows') {
    const sqlCores = Math.max(4, config.vCpus);
    switch (config.sqlLicense) {
        case 'enterprise':
            sqlLicenseCost = 0.399 * sqlCores * config.runningHours;
            break;
        case 'standard':
            sqlLicenseCost = 0.1200 * sqlCores * config.runningHours;
            break;
        case 'web':
            sqlLicenseCost = 0.011 * sqlCores * config.runningHours;
            break;
    }
  }

  const onDemandInclusive = onDemand + osOnDemand + sqlLicenseCost;
  const cud1yInclusive = cud1y + os1yCud + sqlLicenseCost;
  const cud3yInclusive = cud3y + os3yCud + sqlLicenseCost;

  return {
    onDemand,
    cud1y,
    cud3y,
    osOnDemand,
    os1yCud,
    os3yCud,
    sqlLicenseCost,
    onDemandInclusive,
    cud1yInclusive,
    cud3yInclusive,
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
