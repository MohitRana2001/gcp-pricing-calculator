import machineData from '../../data/machine-data.json'

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

export function calculateRealCost(config: VmConfig): CostCalculation {
  const machine = machineData.find(
    (m) => m.name === config.machineType && m.region === config.region
  )

  if (!machine) {
    // Fallback or error handling if machine type not found
    return { estimatedCost: 0, onDemandCost: 0, savings: 0 }
  }

  const baseComputeCost = machine.price
  
  // Apply OS multiplier
  const osMultiplier = OS_MULTIPLIERS[config.operatingSystem] || 1.0
  const computeCostWithOS = baseComputeCost * osMultiplier
  
  // Calculate GPU cost if applicable
  let gpuCost = 0
  if (config.hasGpu && config.gpuType && config.gpuCount) {
    const gpuPricePerHour = GPU_PRICING[config.gpuType] || 0
    gpuCost = gpuPricePerHour * config.gpuCount * config.runningHours
  }
  
  // Calculate storage cost
  const diskPricing = DISK_PRICING[config.diskType] || 0.04
  const storageCost = config.diskSize * diskPricing
  
  // Total monthly cost
  const totalMonthlyCost = (computeCostWithOS + gpuCost + storageCost) * config.quantity
  
  // Apply discount
  const discountMultiplier = DISCOUNT_MULTIPLIERS[config.discountModel] || 1.0
  const estimatedCost = totalMonthlyCost * discountMultiplier
  
  // Calculate savings
  const onDemandCost = totalMonthlyCost // On-demand without discount
  const savings = onDemandCost - estimatedCost
  
  return {
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    onDemandCost: Math.round(onDemandCost * 100) / 100,
    savings: Math.round(savings * 100) / 100,
  }
}

export function getMachineTypeSpecs(machineType: string): { vcpus: number; memory: number } {
  const machine = machineData.find((m) => m.name === machineType);
  if (machine) {
    return { vcpus: machine.vCpus, memory: machine.memoryGB };
  }
  return { vcpus: 2, memory: 8 }; // Default fallback
}

// Check if a machine series supports GPUs
export function seriesSupportsGpu(machineSeries: string): boolean {
  return GPU_TYPES[machineSeries]?.length > 0
}

// Get available GPU types for a machine series
export function getAvailableGpuTypes(machineSeries: string): string[] {
  return GPU_TYPES[machineSeries] || []
}

export const REGIONS = [...new Set(machineData.map((m) => m.region))]
export const MACHINE_SERIES = [...new Set(machineData.map((m) => m.series))]
export const MACHINE_TYPES = [...new Set(machineData.map((m) => m.name))]


export const OPERATING_SYSTEMS = ['Linux', 'Ubuntu Pro', 'Windows Server', 'RHEL', 'SLES']

export const DISK_TYPES = ['Standard', 'Balanced', 'SSD']

export const DISCOUNT_MODELS = ['On-Demand', 'Spot VM', '1-Year CUD', '3-Year CUD']
 