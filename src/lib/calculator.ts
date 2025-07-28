export interface VmConfig {
  id: string
  region: string
  machineType: string
  machineSeries: string
  isCustom: boolean
  vcpus: number
  memory: number
  operatingSystem: string // New field
  runningHours: number // New field (hours per month)
  quantity: number // New field
  diskType: string
  diskSize: number
  // GPU Support
  hasGpu: boolean // New field
  gpuType?: string // New field
  gpuCount?: number // New field
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
  'N1': 0.9, // Added N1 series
  'A2': 2.5, // GPU-optimized series
  'G2': 2.0, // GPU-optimized series
}

// Operating System multipliers
export const OS_MULTIPLIERS: Record<string, number> = {
  'Linux': 1.0,
  'Ubuntu Pro': 1.15,
  'Windows Server': 1.4,
  'RHEL': 1.2,
  'SLES': 1.25,
}

// GPU Types and pricing (per GPU per hour)
export const GPU_TYPES: Record<string, string[]> = {
  'N1': ['nvidia-tesla-k80', 'nvidia-tesla-p4', 'nvidia-tesla-v100', 'nvidia-tesla-p100', 'nvidia-tesla-t4'],
  'A2': ['nvidia-tesla-a100', 'nvidia-a100-80gb'],
  'G2': ['nvidia-l4', 'nvidia-tesla-t4'],
  'N2': [], // No GPU support
  'N2D': [], // No GPU support
  'E2': [], // No GPU support
  'C3': [], // No GPU support
  'M3': [], // No GPU support
}

// GPU pricing per hour (in USD)
export const GPU_PRICING: Record<string, number> = {
  'nvidia-tesla-k80': 0.45,
  'nvidia-tesla-p4': 0.60,
  'nvidia-tesla-p100': 1.46,
  'nvidia-tesla-v100': 2.48,
  'nvidia-tesla-t4': 0.35,
  'nvidia-tesla-a100': 3.673,
  'nvidia-a100-80gb': 4.141,
  'nvidia-l4': 0.596,
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
  
  // Apply OS multiplier
  const osMultiplier = OS_MULTIPLIERS[config.operatingSystem] || 1.0
  const computeCostWithOS = computeCostWithRegion * osMultiplier
  
  // Calculate GPU cost if applicable
  let gpuCost = 0
  if (config.hasGpu && config.gpuType && config.gpuCount) {
    const gpuPricePerHour = GPU_PRICING[config.gpuType] || 0
    gpuCost = gpuPricePerHour * config.gpuCount * config.runningHours
  }
  
  // Calculate storage cost
  const diskPricing = DISK_PRICING[config.diskType] || 0.04
  const storageCost = config.diskSize * diskPricing
  
  // Total monthly cost = (compute + GPU) * running hours + storage
  // Convert compute cost to hourly then multiply by running hours
  const hourlyComputeCost = computeCostWithOS / (24 * 30) // Assuming 30 days per month
  const totalComputeCost = (hourlyComputeCost + (gpuCost / config.runningHours)) * config.runningHours
  
  // Total cost per instance
  const costPerInstance = totalComputeCost + storageCost
  
  // Apply quantity multiplier
  const totalCostForQuantity = costPerInstance * config.quantity
  
  // Apply discount
  const discountMultiplier = DISCOUNT_MULTIPLIERS[config.discountModel] || 1.0
  const estimatedCost = totalCostForQuantity * discountMultiplier
  
  // Calculate savings
  const onDemandCost = totalCostForQuantity // On-demand without discount
  const savings = onDemandCost - estimatedCost
  
  return {
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    onDemandCost: Math.round(onDemandCost * 100) / 100,
    savings: Math.round(savings * 100) / 100,
  }
}

// Machine type options based on series (expanded with GPU-capable series)
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
  ],
  'N1': [
    'n1-standard-1', 'n1-standard-2', 'n1-standard-4', 'n1-standard-8',
    'n1-standard-16', 'n1-standard-32', 'n1-standard-64', 'n1-standard-96'
  ],
  'A2': [
    'a2-highgpu-1g', 'a2-highgpu-2g', 'a2-highgpu-4g', 'a2-highgpu-8g',
    'a2-megagpu-16g', 'a2-ultragpu-1g', 'a2-ultragpu-2g', 'a2-ultragpu-4g', 'a2-ultragpu-8g'
  ],
  'G2': [
    'g2-standard-4', 'g2-standard-8', 'g2-standard-12', 'g2-standard-16',
    'g2-standard-24', 'g2-standard-32', 'g2-standard-48', 'g2-standard-96'
  ]
}

// Get default vCPUs and memory for machine types (expanded)
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
    
    // N1 series
    'n1-standard-1': { vcpus: 1, memory: 3.75 },
    'n1-standard-2': { vcpus: 2, memory: 7.5 },
    'n1-standard-4': { vcpus: 4, memory: 15 },
    'n1-standard-8': { vcpus: 8, memory: 30 },
    'n1-standard-16': { vcpus: 16, memory: 60 },
    'n1-standard-32': { vcpus: 32, memory: 120 },
    'n1-standard-64': { vcpus: 64, memory: 240 },
    'n1-standard-96': { vcpus: 96, memory: 360 },
    
    // A2 series (GPU-optimized)
    'a2-highgpu-1g': { vcpus: 12, memory: 85 },
    'a2-highgpu-2g': { vcpus: 24, memory: 170 },
    'a2-highgpu-4g': { vcpus: 48, memory: 340 },
    'a2-highgpu-8g': { vcpus: 96, memory: 680 },
    'a2-megagpu-16g': { vcpus: 96, memory: 1360 },
    'a2-ultragpu-1g': { vcpus: 12, memory: 170 },
    'a2-ultragpu-2g': { vcpus: 24, memory: 340 },
    'a2-ultragpu-4g': { vcpus: 48, memory: 680 },
    'a2-ultragpu-8g': { vcpus: 96, memory: 1360 },
    
    // G2 series (GPU-optimized)
    'g2-standard-4': { vcpus: 4, memory: 16 },
    'g2-standard-8': { vcpus: 8, memory: 32 },
    'g2-standard-12': { vcpus: 12, memory: 48 },
    'g2-standard-16': { vcpus: 16, memory: 64 },
    'g2-standard-24': { vcpus: 24, memory: 96 },
    'g2-standard-32': { vcpus: 32, memory: 128 },
    'g2-standard-48': { vcpus: 48, memory: 192 },
    'g2-standard-96': { vcpus: 96, memory: 384 },
  }
  
  return specs[machineType] || { vcpus: 2, memory: 8 }
}

// Check if a machine series supports GPUs
export function seriesSupportsGpu(machineSeries: string): boolean {
  return GPU_TYPES[machineSeries]?.length > 0
}

// Get available GPU types for a machine series
export function getAvailableGpuTypes(machineSeries: string): string[] {
  return GPU_TYPES[machineSeries] || []
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

export const MACHINE_SERIES = ['E2', 'N2', 'N2D', 'C3', 'M3', 'N1', 'A2', 'G2']

export const OPERATING_SYSTEMS = ['Linux', 'Ubuntu Pro', 'Windows Server', 'RHEL', 'SLES']

export const DISK_TYPES = ['Standard', 'Balanced', 'SSD']

export const DISCOUNT_MODELS = ['On-Demand', 'Spot VM', '1-Year CUD', '3-Year CUD'] 