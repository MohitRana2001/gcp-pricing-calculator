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
  
  // Pricing structure (per hour rates)
  onDemandPerHour: number // On-demand per hour
  cudOneYearPerHour: number // Resource-based CUD - 1 year
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
  name: string
  series: string
  family: string
  description: string
  regionLocation: string
  vCpus: number
  cpuPlatform: string
  memoryGB: number
  onDemandPerHour: number
  cudOneYearPerHour: number
  cudThreeYearPerHour: number
  spotPerHour: number
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
    const response = await fetch('/data/machine-data.json')
    const data = await response.json()
    
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
      onDemandPerHour: item.price / 730, // Convert monthly to hourly
      cudOneYearPerHour: (item.price * 0.65) / 730, // 35% discount
      cudThreeYearPerHour: (item.price * 0.45) / 730, // 55% discount  
      spotPerHour: (item.price * 0.2) / 730, // 80% discount
    }))
  } catch (error) {
    console.error('Failed to load machine types data:', error)
  }
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

export function calculateMockCost(config: VmConfig): CostCalculation {
  let hourlyRate = 0
  
  // Select pricing based on discount model
  switch (config.discountModel) {
    case '1-Year CUD':
      hourlyRate = config.cudOneYearPerHour
      break
    case '3-Year CUD':
      hourlyRate = config.cudThreeYearPerHour
      break
    case 'Spot VM':
      hourlyRate = config.spotPerHour
      break
    case 'On-Demand':
    default:
      hourlyRate = config.onDemandPerHour
      break
  }
  
  // Calculate compute cost
  const computeCost = hourlyRate * config.runningHours * config.quantity
  
  // Calculate storage cost
  const diskPricing = DISK_PRICING[config.diskType] || 0.04
  const storageCost = config.diskSize * diskPricing * config.quantity
  
  // Total estimated cost
  const estimatedCost = computeCost + storageCost
  
  // On-demand cost for comparison
  const onDemandComputeCost = config.onDemandPerHour * config.runningHours * config.quantity
  const onDemandCost = onDemandComputeCost + storageCost
  
  // Calculate savings
  const savings = onDemandCost - estimatedCost
  
  return {
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    onDemandCost: Math.round(onDemandCost * 100) / 100,
    savings: Math.round(savings * 100) / 100,
  }
}

// Initialize data loading
if (typeof window !== 'undefined') {
  loadMachineTypesData()
}
 