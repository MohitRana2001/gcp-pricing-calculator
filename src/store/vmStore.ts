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
    name: 'New Configuration',
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
      selectedIds: new Set([...state.selectedIds].filter((selectedId) => selectedId !== id)),
    }))
  },

  removeMultipleConfigurations: (ids) => {
    set((state) => ({
      configurations: state.configurations.filter((config) => !ids.includes(config.id)),
      selectedIds: new Set([...state.selectedIds].filter((selectedId) => !ids.includes(selectedId))),
    }))
  },

  updateConfiguration: (id, updates) => {
    set((state) => ({
      configurations: state.configurations.map((config) => {
        if (config.id === id) {
          const updatedConfig = { ...config, ...updates }
          
          // Auto-update machine type specs if machine type changed
          if (updates.machineType && updates.machineType !== config.machineType) {
            const specs = getMachineTypeSpecs(updates.machineType)
            updatedConfig.vcpus = specs.vcpus
            updatedConfig.memory = specs.memory
          }
          
          // Auto-update machine types if series changed
          if (updates.machineSeries && updates.machineSeries !== config.machineSeries) {
            const availableTypes = MACHINE_TYPES[updates.machineSeries] || []
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
      const newConfig = {
        ...config,
        name: `${config.name} (Copy)`,
      }
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
          name: 'Web Server',
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
          name: 'Database Server',
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
          name: 'Compute Intensive',
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