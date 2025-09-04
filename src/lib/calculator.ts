export interface VmConfig {
  id: string
  name: string
  series: string
  family: string
  description: string
  regionLocation: string
  vCpus: number
  cpuPlatform: string
  memoryGB: number
  isCustom: boolean
  os: string
  sqlLicense: string
  provisioningModel: string

  onDemandPerHour: number
  cudOneYearPerHour: number
  cudThreeYearPerHour: number
  spotPerHour: number

  runningHours: number
  quantity: number
  estimatedCost: number
  onDemandCost: number
  savings: number
  commitment: string;
  extendedMemoryEnabled?: boolean;

  links?: {
    onDemand?: string;
    oneYear?: string;
    threeYear?: string;
  }
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
  monthRhelSap: number;
  monthRhelSap1yCud: number;
  monthRhelSap3yCud: number;
  monthRhel: number;
  monthRhel1yCud: number;
  monthRhel3yCud: number;
  monthWindows: number;
}

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
  'asia-south2',
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

export interface MachineConfig {
  minMemoryPerVcpu: number;
  maxMemoryPerVcpu: number;
  maxVcpus: number;
  maxMemoryGB: number;
  supportsExtendedMemory: boolean
}

// Memory configuration for custom instances
export const MEMORY_CONFIGS: Record<string, MachineConfig> = {
  'n2': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 8, maxVcpus: 128, maxMemoryGB: 864, supportsExtendedMemory: true },
  'n2d': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 8, maxVcpus: 224, maxMemoryGB: 896, supportsExtendedMemory: true },
  'n1': { minMemoryPerVcpu: 0.9, maxMemoryPerVcpu: 6.5, maxVcpus: 96, maxMemoryGB: 624,supportsExtendedMemory: true },
  'e2': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 8, maxVcpus: 128, maxMemoryGB: 512, supportsExtendedMemory: false },
  'c3': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 4, maxVcpus: 176, maxMemoryGB: 704, supportsExtendedMemory: false },
  'c3d': { minMemoryPerVcpu: 0.5, maxMemoryPerVcpu: 4, maxVcpus: 360, maxMemoryGB: 1440, supportsExtendedMemory: false },
  'c4': { minMemoryPerVcpu: 1, maxMemoryPerVcpu: 2, maxVcpus: 192, maxMemoryGB: 768, supportsExtendedMemory: false },
  'm1': { minMemoryPerVcpu: 14.9, maxMemoryPerVcpu: 14.9, maxVcpus: 128, maxMemoryGB: 1024, supportsExtendedMemory: false },
  'm2': { minMemoryPerVcpu: 11.7, maxMemoryPerVcpu: 11.7, maxVcpus: 128, maxMemoryGB: 1024, supportsExtendedMemory: false },
  'm3': { minMemoryPerVcpu: 30.5, maxMemoryPerVcpu: 30.5, maxVcpus: 128, maxMemoryGB: 1024, supportsExtendedMemory: false },
  't2d': { minMemoryPerVcpu: 1, maxMemoryPerVcpu: 4, maxVcpus: 60, maxMemoryGB: 240, supportsExtendedMemory: false }
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
let customPricingData: any = {};

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
      vCpus: parseInt(item.vCpus, 10),
      cpuPlatform: getCpuPlatform(item.series),
      memoryGB: parseFloat(item.memoryGB),
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

export async function loadCustomPricingData(): Promise<void> {
    try {
      const response = await fetch('/data/custom-extended.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      customPricingData = await response.json();
      console.log(customPricingData)
    } catch (error) {
      console.error('Failed to load custom pricing data:', error);
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
  let onDemand = 0;
  let cud1y = 0;
  let cud3y = 0;
  const HOURS_IN_MONTH = 730;

  const returnZero = { onDemand: 0, cud1y: 0, cud3y: 0, osOnDemand: 0, os1yCud: 0, os3yCud: 0, sqlLicenseCost: 0, onDemandInclusive: 0, cud1yInclusive: 0, cud3yInclusive: 0 };

  if (config.isCustom) {
      let regionKey = config.regionLocation.toLowerCase();
      const pricing = customPricingData[config.series]?.[regionKey];
      if (pricing) {
          const vcpuPricing = pricing['Custom vCPUs']?.pricing;
          const memoryPricing = pricing['Custom Memory']?.pricing;

          if (vcpuPricing && memoryPricing) {
              const onDemandVcpuRate = vcpuPricing['Default (USD)'] || 0;
              const onDemandMemoryRate = memoryPricing['Default (USD)'] || 0;
              onDemand = (onDemandVcpuRate * config.vCpus + onDemandMemoryRate * config.memoryGB) * config.runningHours;

              const cud1yVcpuRate = vcpuPricing['Flexible CUD - 1 Year (USD)'] || 0;
              const cud1yMemoryRate = memoryPricing['Flexible CUD - 1 Year (USD)'] || 0;
              cud1y = (cud1yVcpuRate * config.vCpus + cud1yMemoryRate * config.memoryGB) * HOURS_IN_MONTH;
              
              const cud3yVcpuRate = vcpuPricing['Flexible CUD - 3 Year (USD)'] || 0;
              const cud3yMemoryRate = memoryPricing['Flexible CUD - 3 Year (USD)'] || 0;
              cud3y = (cud3yVcpuRate * config.vCpus + cud3yMemoryRate * config.memoryGB) * HOURS_IN_MONTH;
          }
      } else {
        return returnZero;
      }
  } else {
      const machine = machineTypesData.find(m => m.name === config.name && m.regionLocation === config.regionLocation);
      if (!machine) return returnZero;
      
      onDemand = (Number(machine.onDemandPerHour) || 0) * config.runningHours;
      cud1y = Number(machine.month1yCud) || 0;
      cud3y = Number(machine.month3yCud) || 0;
  }
  
  if (config.provisioningModel === 'spot') {
    if(!config.isCustom) {
      const machine = machineTypesData.find(m => m.name === config.name && m.regionLocation === config.regionLocation);
      onDemand = (Number(machine?.spotPerHour) || 0) * config.runningHours;
    }
    cud1y = 0; 
    cud3y = 0;
  }

  let osOnDemand = 0, os1yCud = 0, os3yCud = 0;
  const machineForOs = config.isCustom 
    ? machineTypesData.find(m => m.series === config.series && m.regionLocation === config.regionLocation)
    : machineTypesData.find(m => m.name === config.name && m.regionLocation === config.regionLocation);

  if (machineForOs) {
      switch (config.os) {
          case 'windows': osOnDemand = os1yCud = os3yCud = Number(machineForOs.monthWindows) || 0; break;
          case 'rhel': osOnDemand = Number(machineForOs.monthRhel) || 0; os1yCud = Number(machineForOs.monthRhel1yCud) || 0; os3yCud = Number(machineForOs.monthRhel3yCud) || 0; break;
          case 'rhel_sap': osOnDemand = Number(machineForOs.monthRhelSap) || 0; os1yCud = Number(machineForOs.monthRhelSap1yCud) || 0; os3yCud = Number(machineForOs.monthRhelSap3yCud) || 0; break;
          case 'sles': osOnDemand = Number(machineForOs.monthSles) || 0; os1yCud = Number(machineForOs.monthSlesSap1yCud) || 0; os3yCud = Number(machineForOs.monthSlesSap3yCud) || 0; break;
          case 'sles_sap': osOnDemand = Number(machineForOs.monthSlesSap) || 0; os1yCud = Number(machineForOs.monthSlesSap1yCud) || 0; os3yCud = Number(machineForOs.monthSlesSap3yCud) || 0; break;
          case 'ubuntu_pro': osOnDemand = os1yCud = os3yCud = getUbuntuProCost(config.vCpus, config.memoryGB, config.runningHours); break;
          case 'rhel_7_els': osOnDemand = os1yCud = os3yCud = getRhel7ElsCost(config.vCpus, config.runningHours); break;
      }
  }

  let sqlLicenseCost = 0;
  if (config.os === 'windows') {
      const sqlCores = Math.max(4, config.vCpus);
      switch (config.sqlLicense) {
          case 'enterprise': sqlLicenseCost = 0.399 * sqlCores * config.runningHours; break;
          case 'standard': sqlLicenseCost = 0.1200 * sqlCores * config.runningHours; break;
          case 'web': sqlLicenseCost = 0.011 * sqlCores * config.runningHours; break;
      }
  }

  let extendedMemoryCostOnDemand = 0, extendedMemoryCost1y = 0, extendedMemoryCost3y = 0;
  if (config.extendedMemoryEnabled && seriesSupportsExtendedMemory(config.series)) {
      const seriesConfig = MEMORY_CONFIGS[config.series];
      const standardMemoryLimit = config.vCpus * seriesConfig.maxMemoryPerVcpu;
      if (config.memoryGB > standardMemoryLimit) {
          const extraMemoryGB = config.memoryGB - standardMemoryLimit;
          let regionKey = config.regionLocation.toLowerCase();
          if (regionKey === 'asia-south1') {
              regionKey = 'mumbai';
          } else if (regionKey === 'asia-south2') {
              regionKey = 'delhi';
          }
          const pricing = customPricingData[config.series]?.[regionKey]?.['Extended custom memory']?.pricing;
          if (pricing) {
              extendedMemoryCostOnDemand = (pricing['Default (USD)'] || 0) * extraMemoryGB * config.runningHours;
              extendedMemoryCost1y = (pricing['Flexible CUD - 1 Year (USD)'] || 0) * extraMemoryGB * HOURS_IN_MONTH;
              extendedMemoryCost3y = (pricing['Flexible CUD - 3 Year (USD)'] || 0) * extraMemoryGB * HOURS_IN_MONTH;
              if (config.provisioningModel === 'spot') {
                  extendedMemoryCost1y = 0;
                  extendedMemoryCost3y = 0;
              }
          }
      }
  }

  return {
      onDemand, cud1y, cud3y,
      osOnDemand, os1yCud, os3yCud,
      sqlLicenseCost,
      onDemandInclusive: onDemand + osOnDemand + sqlLicenseCost + extendedMemoryCostOnDemand,
      cud1yInclusive: cud1y + os1yCud + sqlLicenseCost + extendedMemoryCost1y,
      cud3yInclusive: cud3y + os3yCud + sqlLicenseCost + extendedMemoryCost3y,
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

// Find matching machine type based on vCPU and memory configuration
export function findMatchingMachineType(series: string, region: string, vCpus: number, memoryGB: number): MachineTypeData | null {
  return machineTypesData.find(machine => 
    machine.series === series && 
    machine.regionLocation === region &&
    machine.vCpus === vCpus &&
    machine.memoryGB === memoryGB
  ) || null
}

if (typeof window !== 'undefined') {
  loadMachineTypesData();
  loadCustomPricingData();
}