import { create } from 'zustand'
import { VmConfig, calculateMockCost, getMachineTypeSpecs, MACHINE_TYPES } from '@/lib/calculator'

interface VmStore {
  configurations: VmConfig[]
  selectedIds: Set<string>
  
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
  
  // Preset configurations
  addPresetConfiguration: (presetType: 'web-server' | 'database-server' | 'compute-intensive') => void
  
  // CSV operations
  exportToCSV: () => void
  importFromCSV: (csvData: string) => void
  
  // Statistics
  getTotalConfigurations: () => number
  getAverageCost: () => number
  getTotalSavings: () => number
  getTotalMonthlyCost: () => number
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

function createDefaultConfiguration(overrides: Partial<VmConfig> = {}): Omit<VmConfig, 'id' | 'estimatedCost' | 'onDemandCost' | 'savings'> {
  const defaults = {
    region: 'us-central1',
    machineSeries: 'E2',
    machineType: 'e2-standard-2',
    isCustom: false,
    vcpus: 2,
    memory: 8,
    diskType: 'Balanced',
    diskSize: 50,
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

export const useVmStore = create<VmStore>((set, get) => ({
  configurations: [],
  selectedIds: new Set<string>(),

  addConfiguration: (config) => {
    const id = generateId()
    const fullConfig: VmConfig = {
      ...config,
      id,
      estimatedCost: 0,
      onDemandCost: 0,
      savings: 0,
    }
    
    // Calculate costs
    const costs = calculateMockCost(fullConfig)
    fullConfig.estimatedCost = costs.estimatedCost
    fullConfig.onDemandCost = costs.onDemandCost
    fullConfig.savings = costs.savings
    
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
          
          // Auto-update machine type specs if machine type changed
          if (updates.machineType && updates.machineType !== config.machineType && !updatedConfig.isCustom) {
            const specs = getMachineTypeSpecs(updates.machineType)
            updatedConfig.vcpus = specs.vcpus
            updatedConfig.memory = specs.memory
          }
          
          // Auto-update machine types if series changed
          if (updates.machineSeries && updates.machineSeries !== config.machineSeries && !updatedConfig.isCustom) {
            const availableTypes = MACHINE_TYPES[updates.machineSeries] || []
            if (availableTypes.length > 0) {
              updatedConfig.machineType = availableTypes[0]
              const specs = getMachineTypeSpecs(availableTypes[0])
              updatedConfig.vcpus = specs.vcpus
              updatedConfig.memory = specs.memory
            }
          }
          
          // If switching to custom, don't auto-update specs
          if (updates.isCustom === true) {
            updatedConfig.machineType = 'custom'
          }
          
          // If switching from custom to predefined, reset to series default
          if (updates.isCustom === false && config.isCustom === true) {
            const availableTypes = MACHINE_TYPES[updatedConfig.machineSeries] || []
            if (availableTypes.length > 0) {
              updatedConfig.machineType = availableTypes[0]
              const specs = getMachineTypeSpecs(availableTypes[0])
              updatedConfig.vcpus = specs.vcpus
              updatedConfig.memory = specs.memory
            }
          }
          
          // Recalculate costs
          const costs = calculateMockCost(updatedConfig)
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

  addPresetConfiguration: (presetType) => {
    let presetConfig: Omit<VmConfig, 'id' | 'estimatedCost' | 'onDemandCost' | 'savings'>
    
    switch (presetType) {
      case 'web-server':
        presetConfig = createDefaultConfiguration({
          machineSeries: 'E2',
          machineType: 'e2-medium',
          vcpus: 1,
          memory: 4,
          diskType: 'Balanced',
          diskSize: 50,
          discountModel: 'On-Demand',
        })
        break
      case 'database-server':
        presetConfig = createDefaultConfiguration({
          machineSeries: 'N2',
          machineType: 'n2-standard-4',
          vcpus: 4,
          memory: 16,
          diskType: 'SSD',
          diskSize: 200,
          discountModel: '1-Year CUD',
        })
        break
      case 'compute-intensive':
        presetConfig = createDefaultConfiguration({
          machineSeries: 'C3',
          machineType: 'c3-standard-8',
          vcpus: 8,
          memory: 32,
          diskType: 'Balanced',
          diskSize: 100,
          discountModel: 'Spot VM',
        })
        break
      default:
        presetConfig = createDefaultConfiguration()
    }
    
    get().addConfiguration(presetConfig)
  },

  exportToCSV: () => {
    const configs = get().configurations
    if (configs.length === 0) {
      alert('No configurations to export')
      return
    }

    const headers = [
      'Region',
      'Machine Series',
      'Machine Type',
      'Is Custom',
      'vCPUs',
      'Memory (GB)',
      'Disk Type',
      'Disk Size (GB)',
      'Discount Model',
      'Estimated Cost ($)',
      'On-Demand Cost ($)',
      'Savings ($)'
    ]

    const csvContent = [
      headers.join(','),
      ...configs.map(config => [
        config.region,
        config.machineSeries,
        config.machineType,
        config.isCustom,
        config.vcpus,
        config.memory,
        config.diskType,
        config.diskSize,
        config.discountModel,
        config.estimatedCost,
        config.onDemandCost,
        config.savings
      ].join(','))
    ].join('\n')

    const timestamp = new Date().toISOString().split('T')[0]
    downloadCSV(csvContent, `gcp-pricing-${timestamp}.csv`)
  },

  importFromCSV: (csvData) => {
    try {
      const parsedData = parseCSV(csvData)
      const configurations = parsedData.map(row => ({
        region: row['Region'] || 'us-central1',
        machineSeries: row['Machine Series'] || 'E2',
        machineType: row['Machine Type'] || 'e2-standard-2',
        isCustom: row['Is Custom'] === 'true' || row['Is Custom'] === true,
        vcpus: parseInt(row['vCPUs']) || 2,
        memory: parseInt(row['Memory (GB)']) || 8,
        diskType: row['Disk Type'] || 'Balanced',
        diskSize: parseInt(row['Disk Size (GB)']) || 50,
        discountModel: row['Discount Model'] || 'On-Demand',
      }))

      // Add all configurations
      configurations.forEach(config => get().addConfiguration(config))
      
    } catch (error) {
      console.error('Error importing CSV:', error)
      alert('Error importing CSV file. Please check the format.')
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
})) 