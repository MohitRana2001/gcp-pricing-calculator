export interface VmConfig {
  id: string
  region: string
  machineType: string
  machineSeries: string
  isCustom: boolean
  vcpus: number
  memory: number
  diskType: string
  diskSize: number
  discountModel: string
  cudType?: string
  estimatedCost: number
  onDemandCost: number
  savings: number
}

export interface CostCalculation {
  estimatedCost: number
  onDemandCost: number
  savings: number
}

// Regional pricing multipliers
export const REGION_MULTIPLIERS: Record<string, number> = {
  'us-central1': 1.0,
  'us-east1': 1.0,
  'us-west1': 1.05,
  'europe-west1': 1.1,
  'europe-west4': 1.1,
  'asia-southeast1': 1.2,
  'asia-east1': 1.15,
}

// Machine series multipliers
export const SERIES_MULTIPLIERS: Record<string, number> = {
  'E2': 0.8,
  'N2': 1.0,
  'N2D': 0.95,
  'C3': 1.3,
  'M3': 1.5,
}

// Disk type pricing (per GB per month)
export const DISK_PRICING: Record<string, number> = {
  'Standard': 0.04,
  'Balanced': 0.10,
  'SSD': 0.17,
}

// Discount multipliers
export const DISCOUNT_MULTIPLIERS: Record<string, number> = {
  'On-Demand': 1.0,
  'Spot VM': 0.2, // 80% discount
  '1-Year CUD': 0.65, // 35% discount
  '3-Year CUD': 0.45, // 55% discount
}

export function calculateMockCost(config: VmConfig): CostCalculation {
  // Base compute cost formula: vCPUs * $24 + Memory * $3.2
  const baseComputeCost = (config.vcpus * 24) + (config.memory * 3.2)
  
  // Apply series multiplier
  const seriesMultiplier = SERIES_MULTIPLIERS[config.machineSeries] || 1.0
  const computeCostWithSeries = baseComputeCost * seriesMultiplier
  
  // Apply regional multiplier
  const regionMultiplier = REGION_MULTIPLIERS[config.region] || 1.0
  const computeCostWithRegion = computeCostWithSeries * regionMultiplier
  
  // Calculate storage cost
  const diskPricing = DISK_PRICING[config.diskType] || 0.04
  const storageCost = config.diskSize * diskPricing
  
  // Total on-demand cost
  const onDemandCost = computeCostWithRegion + storageCost
  
  // Apply discount
  const discountMultiplier = DISCOUNT_MULTIPLIERS[config.discountModel] || 1.0
  const estimatedCost = onDemandCost * discountMultiplier
  
  // Calculate savings
  const savings = onDemandCost - estimatedCost
  
  return {
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    onDemandCost: Math.round(onDemandCost * 100) / 100,
    savings: Math.round(savings * 100) / 100,
  }
}

// Machine type options based on series
export const MACHINE_TYPES: Record<string, string[]> = {
  'E2': [
    'e2-micro', 'e2-small', 'e2-medium', 'e2-standard-2', 'e2-standard-4',
    'e2-standard-8', 'e2-standard-16', 'e2-standard-32'
  ],
  'N2': [
    'n2-standard-2', 'n2-standard-4', 'n2-standard-8', 'n2-standard-16',
    'n2-standard-32', 'n2-standard-48', 'n2-standard-64', 'n2-standard-80'
  ],
  'N2D': [
    'n2d-standard-2', 'n2d-standard-4', 'n2d-standard-8', 'n2d-standard-16',
    'n2d-standard-32', 'n2d-standard-48', 'n2d-standard-64', 'n2d-standard-80'
  ],
  'C3': [
    'c3-standard-4', 'c3-standard-8', 'c3-standard-22', 'c3-standard-44',
    'c3-standard-88', 'c3-standard-176'
  ],
  'M3': [
    'm3-ultramem-32', 'm3-ultramem-64', 'm3-ultramem-128',
    'm3-megamem-64', 'm3-megamem-128'
  ]
}

// Get default vCPUs and memory for machine types
export function getMachineTypeSpecs(machineType: string): { vcpus: number; memory: number } {
  const specs: Record<string, { vcpus: number; memory: number }> = {
    // E2 series
    'e2-micro': { vcpus: 1, memory: 1 },
    'e2-small': { vcpus: 1, memory: 2 },
    'e2-medium': { vcpus: 1, memory: 4 },
    'e2-standard-2': { vcpus: 2, memory: 8 },
    'e2-standard-4': { vcpus: 4, memory: 16 },
    'e2-standard-8': { vcpus: 8, memory: 32 },
    'e2-standard-16': { vcpus: 16, memory: 64 },
    'e2-standard-32': { vcpus: 32, memory: 128 },
    
    // N2 series
    'n2-standard-2': { vcpus: 2, memory: 8 },
    'n2-standard-4': { vcpus: 4, memory: 16 },
    'n2-standard-8': { vcpus: 8, memory: 32 },
    'n2-standard-16': { vcpus: 16, memory: 64 },
    'n2-standard-32': { vcpus: 32, memory: 128 },
    'n2-standard-48': { vcpus: 48, memory: 192 },
    'n2-standard-64': { vcpus: 64, memory: 256 },
    'n2-standard-80': { vcpus: 80, memory: 320 },
    
    // N2D series
    'n2d-standard-2': { vcpus: 2, memory: 8 },
    'n2d-standard-4': { vcpus: 4, memory: 16 },
    'n2d-standard-8': { vcpus: 8, memory: 32 },
    'n2d-standard-16': { vcpus: 16, memory: 64 },
    'n2d-standard-32': { vcpus: 32, memory: 128 },
    'n2d-standard-48': { vcpus: 48, memory: 192 },
    'n2d-standard-64': { vcpus: 64, memory: 256 },
    'n2d-standard-80': { vcpus: 80, memory: 320 },
    
    // C3 series
    'c3-standard-4': { vcpus: 4, memory: 16 },
    'c3-standard-8': { vcpus: 8, memory: 32 },
    'c3-standard-22': { vcpus: 22, memory: 88 },
    'c3-standard-44': { vcpus: 44, memory: 176 },
    'c3-standard-88': { vcpus: 88, memory: 352 },
    'c3-standard-176': { vcpus: 176, memory: 704 },
    
    // M3 series
    'm3-ultramem-32': { vcpus: 32, memory: 976 },
    'm3-ultramem-64': { vcpus: 64, memory: 1952 },
    'm3-ultramem-128': { vcpus: 128, memory: 3904 },
    'm3-megamem-64': { vcpus: 64, memory: 976 },
    'm3-megamem-128': { vcpus: 128, memory: 1952 },
  }
  
  return specs[machineType] || { vcpus: 2, memory: 8 }
}

export const REGIONS = [
  'us-central1',
  'us-east1',
  'us-west1',
  'europe-west1',
  'europe-west4',
  'asia-southeast1',
  'asia-east1',
]

export const MACHINE_SERIES = ['E2', 'N2', 'N2D', 'C3', 'M3']

export const DISK_TYPES = ['Standard', 'Balanced', 'SSD']

export const DISCOUNT_MODELS = ['On-Demand', 'Spot VM', '1-Year CUD', '3-Year CUD'] 