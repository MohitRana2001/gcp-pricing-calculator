import { create } from 'zustand'
import { VmConfig, getMachineTypeSpecs, getAvailableMachineTypes, seriesSupportsExtendedMemory, getAllowedMemoryRange, loadMachineTypesData, getPricing } from '@/lib/calculator'

export type ServiceType = 'compute-engine' | 'cloud-storage' | 'cloud-sql' | null

interface CloudStorageConfig {
  id: string
  name: string
  storageClass: string
  region: string
  storageAmount: number // in GB
  networkEgress: number // in GB
  operations: number // number of operations
  estimatedCost: number
}

interface CloudSQLConfig {
  id: string
  name: string
  databaseEngine: string
  tier: string
  region: string
  storage: number // in GB
  backupStorage: number // in GB
  estimatedCost: number
}

interface VmStore {
  // Service selection
  selectedService: ServiceType
  setSelectedService: (service: ServiceType) => void
  
  // Compute Engine
  configurations: VmConfig[]
  selectedIds: Set<string>
  dataLoaded: boolean
  
  // Cloud Storage (placeholder for future)
  storageConfigurations: CloudStorageConfig[]
  
  // Cloud SQL (placeholder for future)
  sqlConfigurations: CloudSQLConfig[]
  
  // Configuration management
  addConfiguration: (config: Omit<VmConfig, 'id' | 'estimatedCost' | 'onDemandCost' | 'savings'>) => void
  removeConfiguration: (id: string) => void
  removeMultipleConfigurations: (ids: string[]) => void
  updateConfiguration: (id: string, updates: Partial<VmConfig>) => void
  duplicateConfiguration: (id: string) => void
  duplicateMultipleConfigurations: (ids: string[]) => void
  
  // Selection management
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  
  // CSV operations with AI intelligence
  exportToCSV: () => void
  importFromCSV: (csvData: string) => Promise<void>
  intelligentCSVMapping: (csvData: string) => Promise<any[]>
  
  // Data loading
  initializeData: () => Promise<void>
  
  // Statistics
  getTotalConfigurations: () => number
  getAverageCost: () => number
  getTotalSavings: () => number
  getTotalMonthlyCost: () => number
  
  // Service-specific statistics
  getComputeEngineCost: () => number
  getCloudStorageCost: () => number
  getCloudSQLCost: () => number
  getTotalServicesCost: () => number
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

// Calculate costs based on configuration
function calculateCosts(config: any): {
  estimatedCost: number
  onDemandCost: number
  savings: number
} {
  // Create a complete config object with defaults for missing optional fields
  const completeConfig: VmConfig = {
    ...config,
    id: config.id || 'temp', // Temporary ID for calculation
    estimatedCost: 0,
    onDemandCost: 0,
    savings: 0,
    os: config.os || 'linux', // Default to linux if not provided
    sqlLicense: config.sqlLicense || 'none', // Default to none if not provided
    discountModel: config.discountModel || 'On-Demand', // Default discount model
  } as VmConfig
  
  const pricing = getPricing(completeConfig)
  
  // Calculate total costs considering quantity and running hours
  const baseOnDemandMonthly = pricing.onDemand * (config.quantity || 1)
  const baseCud1yMonthly = pricing.cud1y * (config.quantity || 1)
  const baseCud3yMonthly = pricing.cud3y * (config.quantity || 1)
  
  // If running hours is different from 730 (full month), calculate proportionally
  const hourlyFactor = (config.runningHours || 730) / 730
  
  const onDemandCost = baseOnDemandMonthly * hourlyFactor
  const cud1yCost = baseCud1yMonthly * hourlyFactor
  const cud3yCost = baseCud3yMonthly * hourlyFactor
  
  let estimatedCost: number
  let savings: number
  
  // Calculate estimated cost based on discount model
  const discountModel = config.discountModel || 'On-Demand'
  switch (discountModel) {
    case '1-Year CUD':
      estimatedCost = cud1yCost
      savings = onDemandCost - cud1yCost
      break
    case '3-Year CUD':
      estimatedCost = cud3yCost
      savings = onDemandCost - cud3yCost
      break
    case 'Spot VM':
      // Spot pricing is typically much lower - use the spot pricing data if available
      const spotCost = (config.spotPerHour || 0) * (config.runningHours || 730) * (config.quantity || 1)
      estimatedCost = spotCost
      savings = onDemandCost - spotCost
      break
    case 'On-Demand':
    default:
      estimatedCost = onDemandCost
      savings = 0
      break
  }
  
  return {
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    onDemandCost: Math.round(onDemandCost * 100) / 100,
    savings: Math.round(Math.max(0, savings) * 100) / 100
  }
}

function createDefaultConfiguration(overrides: Partial<VmConfig> = {}): Omit<VmConfig, 'id' | 'estimatedCost' | 'onDemandCost' | 'savings'> {
  const defaults = {
    name: 'e2-standard-2',
    series: 'e2',
    family: 'General-purpose',
    description: '2 vCPUs 8 GB RAM',
    regionLocation: 'us-central1',
    vCpus: 2,
    cpuPlatform: 'Intel Cascade Lake',
    memoryGB: 8,
    isCustom: false,
    os: 'linux', // Default OS
    sqlLicense: 'none', // Default SQL license
    onDemandPerHour: 0.067123,
    cudOneYearPerHour: 0.043630,
    cudThreeYearPerHour: 0.030205,
    spotPerHour: 0.013425,
    runningHours: 730,
    quantity: 1,
    discountModel: 'On-Demand',
    ...overrides
  }
  
  return defaults
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function parseCSV(csvData: string): any[] {
  const lines = csvData.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
    const obj: any = {}
    headers.forEach((header, index) => {
      obj[header] = values[index] || ''
    })
    return obj
  })
}

// AI-powered intelligent CSV field mapping
async function intelligentFieldMapping(csvHeaders: string[]): Promise<Record<string, string>> {
  const fieldMappings: Record<string, string[]> = {
    name: ['name', 'machine_type', 'instance_type', 'type'],
    series: ['series', 'machine_series', 'family'],
    family: ['family', 'machine_family', 'category'],
    description: ['description', 'desc', 'summary'],
    regionLocation: ['region', 'regionLocation', 'location', 'zone'],
    vCpus: ['vcpu', 'vcpus', 'cpu', 'cpus', 'cores'],
    cpuPlatform: ['cpuPlatform', 'cpu_platform', 'platform', 'processor'],
    memoryGB: ['memory', 'memoryGB', 'ram', 'mem', 'memory_gb'],
    runningHours: ['hours', 'running_hours', 'runtime', 'uptime'],
    quantity: ['quantity', 'count', 'instances', 'num_instances'],
    os: ['os', 'operating_system', 'system'],
    sqlLicense: ['sql_license', 'sql', 'license'],
  }
  
  const mapping: Record<string, string> = {}
  
  for (const [targetField, aliases] of Object.entries(fieldMappings)) {
    for (const header of csvHeaders) {
      const normalizedHeader = header.toLowerCase().replace(/[\s_-]/g, '')
      
      for (const alias of aliases) {
        const normalizedAlias = alias.toLowerCase().replace(/[\s_-]/g, '')
        
        if (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)) {
          mapping[targetField] = header
          break
        }
      }
      
      if (mapping[targetField]) break
    }
  }
  
  return mapping
}

// Smart data transformation
function transformValue(value: string, targetField: string): any {
  if (!value || value === '') return null
  
  switch (targetField) {
    case 'vCpus':
    case 'memoryGB':
    case 'runningHours':
    case 'quantity':
      return parseInt(value) || (targetField === 'quantity' ? 1 : 0)
    
    case 'onDemandPerHour':
    case 'cudOneYearPerHour':
    case 'cudThreeYearPerHour':
    case 'spotPerHour':
      return parseFloat(value) || 0
    
    case 'series':
      const seriesValue = value.toLowerCase()
      if (['c4', 'c3', 'c3d', 'e2', 'n1', 'n2', 'n2d', 'n4', 'm1', 'm2', 'm3', 't2d'].includes(seriesValue)) {
        return seriesValue
      }
      return 'e2'
    
    case 'regionLocation':
      const regionValue = value.toLowerCase().replace(/[\s_-]/g, '')
      if (regionValue.includes('mumbai') || regionValue.includes('asia-south1')) return 'mumbai'
      if (regionValue.includes('uscentral') || regionValue.includes('central')) return 'us-central1'
      if (regionValue.includes('useast')) return 'us-east1'
      if (regionValue.includes('uswest')) return 'us-west1'
      if (regionValue.includes('europe') || regionValue.includes('eu')) return 'europe-west1'
      if (regionValue.includes('asia')) return 'asia-southeast1'
      return 'us-central1'
    
    case 'os':
      const osValue = value.toLowerCase()
      if (['windows', 'rhel', 'rhel_sap', 'sles', 'sles_sap'].includes(osValue)) {
        return osValue
      }
      return 'linux'
    
    case 'sqlLicense':
      const sqlValue = value.toLowerCase()
      if (['standard', 'enterprise', 'web'].includes(sqlValue)) {
        return sqlValue
      }
      return 'none'
    
    default:
      return value
  }
}

export const useVmStore = create<VmStore>((set, get) => ({
  // Service selection
  selectedService: null,
  setSelectedService: (service: ServiceType) => set({ selectedService: service }),
  
  // Compute Engine
  configurations: [],
  selectedIds: new Set<string>(),
  dataLoaded: false,
  
  // Cloud Storage & SQL (placeholders)
  storageConfigurations: [],
  sqlConfigurations: [],

  initializeData: async () => {
    await loadMachineTypesData()
    set({ dataLoaded: true })
  },

  addConfiguration: (config) => {
    const id = generateId()
    const costs = calculateCosts(config)
    const fullConfig: VmConfig = {
      ...config,
      id,
      ...costs
    }
    
    set((state) => ({
      configurations: [...state.configurations, fullConfig],
    }))
  },

  removeConfiguration: (id) => {
    set((state) => ({
      configurations: state.configurations.filter((config) => config.id !== id),
      selectedIds: new Set(Array.from(state.selectedIds).filter((selectedId) => selectedId !== id)),
    }))
  },

  removeMultipleConfigurations: (ids) => {
    set((state) => ({
      configurations: state.configurations.filter((config) => !ids.includes(config.id)),
      selectedIds: new Set(Array.from(state.selectedIds).filter((selectedId) => !ids.includes(selectedId))),
    }))
  },

  updateConfiguration: (id, updates) => {
    set((state) => ({
      configurations: state.configurations.map((config) => {
        if (config.id === id) {
          const updatedConfig = { ...config, ...updates }
          
          // Handle custom memory validation
          if (updates.isCustom !== undefined) {
            if (updates.isCustom === false) {
              // Switching from custom to predefined - load machine type data
              const machineSpec = getMachineTypeSpecs(updatedConfig.name, updatedConfig.regionLocation)
              if (machineSpec) {
                updatedConfig.vCpus = machineSpec.vCpus
                updatedConfig.memoryGB = machineSpec.memoryGB
                updatedConfig.onDemandPerHour = machineSpec.onDemandPerHour
                updatedConfig.cudOneYearPerHour = machineSpec.cudOneYearPerHour
                updatedConfig.cudThreeYearPerHour = machineSpec.cudThreeYearPerHour
                updatedConfig.spotPerHour = machineSpec.spotPerHour
              }
            }
          }
          
          // Handle series change
          if (updates.series && updates.series !== config.series) {
            const availableTypes = getAvailableMachineTypes(updates.series, updatedConfig.regionLocation)
            if (availableTypes.length > 0 && !updatedConfig.isCustom) {
              const firstType = availableTypes[0]
              updatedConfig.name = firstType.name
              updatedConfig.vCpus = firstType.vCpus
              updatedConfig.memoryGB = firstType.memoryGB
              updatedConfig.onDemandPerHour = firstType.onDemandPerHour
              updatedConfig.cudOneYearPerHour = firstType.cudOneYearPerHour
              updatedConfig.cudThreeYearPerHour = firstType.cudThreeYearPerHour
              updatedConfig.spotPerHour = firstType.spotPerHour
            }
          }
          
          // Handle region change
          if (updates.regionLocation && updates.regionLocation !== config.regionLocation) {
            const availableTypes = getAvailableMachineTypes(updatedConfig.series, updates.regionLocation)
            if (availableTypes.length > 0 && !updatedConfig.isCustom) {
              const matchingType = availableTypes.find(t => t.name === updatedConfig.name) || availableTypes[0]
              updatedConfig.name = matchingType.name
              updatedConfig.vCpus = matchingType.vCpus
              updatedConfig.memoryGB = matchingType.memoryGB
              updatedConfig.onDemandPerHour = matchingType.onDemandPerHour
              updatedConfig.cudOneYearPerHour = matchingType.cudOneYearPerHour
              updatedConfig.cudThreeYearPerHour = matchingType.cudThreeYearPerHour
              updatedConfig.spotPerHour = matchingType.spotPerHour
            }
          }
          
          // Validate custom memory if in custom mode
          if (updatedConfig.isCustom && (updates.vCpus || updates.memoryGB)) {
            if (seriesSupportsExtendedMemory(updatedConfig.series)) {
              const memoryRange = getAllowedMemoryRange(updatedConfig.series, updatedConfig.vCpus)
              if (updatedConfig.memoryGB < memoryRange.min) {
                updatedConfig.memoryGB = memoryRange.min
              } else if (updatedConfig.memoryGB > memoryRange.max) {
                updatedConfig.memoryGB = memoryRange.max
              }
            }
          }
          
          // Recalculate costs after all updates
          const costs = calculateCosts(updatedConfig)
          updatedConfig.estimatedCost = costs.estimatedCost
          updatedConfig.onDemandCost = costs.onDemandCost
          updatedConfig.savings = costs.savings
          
          return updatedConfig
        }
        return config
      }),
    }))
  },

  duplicateConfiguration: (id) => {
    const config = get().configurations.find((c) => c.id === id)
    if (config) {
      const newConfig = { ...config }
      delete (newConfig as any).id
      delete (newConfig as any).estimatedCost
      delete (newConfig as any).onDemandCost
      delete (newConfig as any).savings
      
      get().addConfiguration(newConfig)
    }
  },

  duplicateMultipleConfigurations: (ids) => {
    ids.forEach((id) => get().duplicateConfiguration(id))
  },

  toggleSelection: (id) => {
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds)
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id)
      } else {
        newSelectedIds.add(id)
      }
      return { selectedIds: newSelectedIds }
    })
  },

  selectAll: () => {
    set((state) => ({
      selectedIds: new Set(state.configurations.map((config) => config.id)),
    }))
  },

  clearSelection: () => {
    set({ selectedIds: new Set() })
  },

  exportToCSV: () => {
    const configs = get().configurations
    if (configs.length === 0) {
      alert('No configurations to export')
      return
    }

    const headers = [
      'Name',
      'Series',
      'Family',
      'Description',
      'Region Location',
      'vCPUs',
      'CPU Platform',
      'Memory (GB)',
      'Is Custom',
      'Running Hours',
      'Quantity',
      'On-Demand Per Hour ($)',
      'CUD 1-Year Per Hour ($)',
      'CUD 3-Year Per Hour ($)',
      'Spot Per Hour ($)',
      'Estimated Cost ($)',
      'On-Demand Cost ($)',
      'Savings ($)'
    ]

    const csvContent = [
      headers.join(','),
      ...configs.map(config => [
        config.name,
        config.series,
        config.family,
        config.description,
        config.regionLocation,
        config.vCpus,
        config.cpuPlatform,
        config.memoryGB,
        config.isCustom,
        config.runningHours,
        config.quantity,
        config.onDemandPerHour,
        config.cudOneYearPerHour,
        config.cudThreeYearPerHour,
        config.spotPerHour,
        config.estimatedCost,
        config.onDemandCost,
        config.savings
      ].join(','))
    ].join('\n')

    const timestamp = new Date().toISOString().split('T')[0]
    downloadCSV(csvContent, `gcp-compute-engine-${timestamp}.csv`)
  },

  intelligentCSVMapping: async (csvData: string) => {
    const parsedData = parseCSV(csvData)
    if (parsedData.length === 0) return []
    
    const headers = Object.keys(parsedData[0])
    const fieldMapping = await intelligentFieldMapping(headers)
    
    return parsedData.map(row => {
      const mappedConfig: any = {}
      
      for (const [targetField, sourceHeader] of Object.entries(fieldMapping)) {
        if (row[sourceHeader]) {
          const transformedValue = transformValue(row[sourceHeader], targetField)
          if (transformedValue !== null) {
            mappedConfig[targetField] = transformedValue
          }
        }
      }
      
      const defaultConfig = createDefaultConfiguration()
      const finalConfig = { ...defaultConfig, ...mappedConfig }
      
      return finalConfig
    })
  },

  importFromCSV: async (csvData: string) => {
    try {
      const mappedConfigurations = await get().intelligentCSVMapping(csvData)
      
      mappedConfigurations.forEach(config => get().addConfiguration(config))
      
      alert(`Successfully imported ${mappedConfigurations.length} configurations with intelligent field mapping!`)
      
    } catch (error) {
      console.error('Error importing CSV:', error)
      alert('Error importing CSV file. Please check the format and try again.')
    }
  },

  getTotalConfigurations: () => get().configurations.length,

  getAverageCost: () => {
    const configs = get().configurations
    if (configs.length === 0) return 0
    const total = configs.reduce((sum, config) => sum + config.estimatedCost, 0)
    return Math.round((total / configs.length) * 100) / 100
  },

  getTotalSavings: () => {
    const configs = get().configurations
    const total = configs.reduce((sum, config) => sum + config.savings, 0)
    return Math.round(total * 100) / 100
  },

  getTotalMonthlyCost: () => {
    const configs = get().configurations
    const total = configs.reduce((sum, config) => sum + config.estimatedCost, 0)
    return Math.round(total * 100) / 100
  },

  // Service-specific costs
  getComputeEngineCost: () => {
    const configs = get().configurations
    const total = configs.reduce((sum, config) => sum + config.estimatedCost, 0)
    return Math.round(total * 100) / 100
  },

  getCloudStorageCost: () => {
    // Placeholder - will be implemented when Cloud Storage is added
    return 0
  },

  getCloudSQLCost: () => {
    // Placeholder - will be implemented when Cloud SQL is added
    return 0
  },

  getTotalServicesCost: () => {
    return get().getComputeEngineCost() + get().getCloudStorageCost() + get().getCloudSQLCost()
  },
})) 

// Example of how to use the store:
// const { configurations, addConfiguration } = useVmStore.getState()
// addConfiguration({ region: 'us-east1', ... })