import { create } from 'zustand'
import { VmConfig, calculateRealCost, getMachineTypeSpecs, seriesSupportsGpu, getAvailableGpuTypes, MACHINE_SERIES, MACHINE_TYPES, REGIONS } from '@/lib/calculator'

interface VmStore {
  configurations: VmConfig[]
  selectedIds: Set<string>
  
  // Configuration management
  addConfiguration: (config: Omit<VmConfig, 'id' | 'estimatedCost' | 'onDemandCost' | 'savings'>) => void
  removeConfiguration: (id: string) => void
  removeMultipleConfigurations: (ids: string[]) => void
  updateConfiguration: (id: string, updates: Partial<VmConfig>) => void
  updateMultipleConfigurations: (ids: string[], updates: Partial<VmConfig>) => void;
  duplicateConfiguration: (id: string) => void
  duplicateMultipleConfigurations: (ids: string[]) => void
  
  // Selection management
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  
  // Preset configurations
  addPresetConfiguration: (presetType: 'web-server' | 'database-server' | 'compute-intensive') => void
  
  // CSV operations with AI intelligence
  exportToCSV: () => void
  importFromCSV: (csvData: string) => Promise<void>
  intelligentCSVMapping: (csvData: string) => Promise<any[]>
  
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
    machineSeries: 'e2',
    machineType: 'e2-standard-2',
    isCustom: false,
    vcpus: 2,
    memory: 8,
    operatingSystem: 'Linux',
    runningHours: 730, // Full month (24 * 30.42 average days)
    quantity: 1,
    diskType: 'Balanced',
    diskSize: 50,
    hasGpu: false,
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
  // This simulates an AI agent that maps CSV headers to our field names
  // In a real implementation, this would call an LLM API like Gemini
  
  const fieldMappings: Record<string, string[]> = {
    region: ['region', 'location', 'zone', 'area', 'datacenter', 'dc'],
    machineSeries: ['series', 'machine_series', 'vm_series', 'instance_series', 'family', 'type_family'],
    machineType: ['machine_type', 'instance_type', 'vm_type', 'type', 'size', 'flavor'],
    operatingSystem: ['os', 'operating_system', 'system', 'platform', 'image'],
    vcpus: ['vcpu', 'vcpus', 'cpu', 'cpus', 'cores', 'processors'],
    memory: ['memory', 'ram', 'mem', 'memory_gb', 'ram_gb'],
    runningHours: ['hours', 'running_hours', 'runtime', 'uptime', 'usage_hours'],
    quantity: ['quantity', 'count', 'instances', 'num_instances', 'amount'],
    diskType: ['disk_type', 'storage_type', 'disk', 'storage'],
    diskSize: ['disk_size', 'storage_size', 'disk_gb', 'storage_gb'],
    hasGpu: ['gpu', 'has_gpu', 'gpu_enabled', 'accelerator'],
    gpuType: ['gpu_type', 'accelerator_type', 'gpu_model'],
    gpuCount: ['gpu_count', 'num_gpus', 'accelerator_count'],
    discountModel: ['discount', 'pricing_model', 'billing_model', 'commitment']
  }
  
  const mapping: Record<string, string> = {}
  
  // Simple fuzzy matching algorithm (in real implementation, use LLM)
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

// Smart data transformation using AI-like logic
function transformValue(value: string, targetField: string): any {
  if (!value || value === '') return null
  
  switch (targetField) {
    case 'vcpus':
    case 'memory':
    case 'runningHours':
    case 'quantity':
    case 'diskSize':
    case 'gpuCount':
      return parseInt(value) || (targetField === 'quantity' ? 1 : 0)
    
    case 'hasGpu':
      return ['true', 'yes', '1', 'enabled'].includes(value.toLowerCase())
    
    case 'operatingSystem':
      // Smart OS mapping
      const osValue = value.toLowerCase()
      if (osValue.includes('windows')) return 'Windows Server'
      if (osValue.includes('ubuntu')) return 'Ubuntu Pro'
      if (osValue.includes('rhel') || osValue.includes('red hat')) return 'RHEL'
      if (osValue.includes('suse') || osValue.includes('sles')) return 'SLES'
      return 'Linux'
    
    case 'region':
      // Smart region mapping
      const regionValue = value.toLowerCase().replace(/[\s_-]/g, '')
      if (regionValue.includes('uscentral') || regionValue.includes('central')) return 'us-central1'
      if (regionValue.includes('useast')) return 'us-east1'
      if (regionValue.includes('uswest')) return 'us-west1'
      if (regionValue.includes('europe') || regionValue.includes('eu')) return 'europe-west1'
      if (regionValue.includes('asia')) return 'asia-southeast1'
      return 'us-central1'
    
    case 'machineSeries':
      // Smart series mapping
      const seriesValue = value.toUpperCase()
      if (MACHINE_SERIES.includes(seriesValue)) return seriesValue
      if (value.toLowerCase().includes('general')) return 'n2'
      if (value.toLowerCase().includes('compute')) return 'c3'
      if (value.toLowerCase().includes('memory')) return 'm3'
      if (value.toLowerCase().includes('gpu')) return 'a2'
      return 'e2'
    
    case 'diskType':
      const diskValue = value.toLowerCase()
      if (diskValue.includes('ssd')) return 'SSD'
      if (diskValue.includes('balanced')) return 'Balanced'
      return 'Standard'
    
    case 'discountModel':
      const discountValue = value.toLowerCase()
      if (discountValue.includes('spot')) return 'Spot VM'
      if (discountValue.includes('1') && discountValue.includes('year')) return '1-Year CUD'
      if (discountValue.includes('3') && discountValue.includes('year')) return '3-Year CUD'
      return 'On-Demand'
    
    default:
      return value
  }
}

const updateAndRecalculateConfig = (config: VmConfig, updates: Partial<VmConfig>): VmConfig => {
  const updatedConfig = { ...config, ...updates };

  if (updates.machineType && updates.machineType !== config.machineType && !updatedConfig.isCustom) {
    const specs = getMachineTypeSpecs(updates.machineType);
    updatedConfig.vcpus = specs.vcpus;
    updatedConfig.memory = specs.memory;
  }

  if (updates.machineSeries && updates.machineSeries !== config.machineSeries && !updatedConfig.isCustom) {
    const availableTypes = MACHINE_TYPES.filter((m) => m.startsWith(updates.machineSeries!.toLowerCase()));
    if (availableTypes.length > 0) {
      updatedConfig.machineType = availableTypes[0];
      const specs = getMachineTypeSpecs(availableTypes[0]);
      updatedConfig.vcpus = specs.vcpus;
      updatedConfig.memory = specs.memory;
    }
  }

  if (updates.machineSeries && updates.machineSeries !== config.machineSeries) {
    const supportsGpu = seriesSupportsGpu(updates.machineSeries);
    if (!supportsGpu) {
      updatedConfig.hasGpu = false;
      updatedConfig.gpuType = undefined;
      updatedConfig.gpuCount = undefined;
    }
  }

  if (updates.hasGpu === true && !config.hasGpu) {
    const availableGpuTypes = getAvailableGpuTypes(updatedConfig.machineSeries);
    if (availableGpuTypes.length > 0) {
      updatedConfig.gpuType = availableGpuTypes[0];
      updatedConfig.gpuCount = 1;
    }
  }

  if (updates.hasGpu === false) {
    updatedConfig.gpuType = undefined;
    updatedConfig.gpuCount = undefined;
  }

  if (updates.isCustom === true) {
    updatedConfig.machineType = 'custom';
  }

  if (updates.isCustom === false && config.isCustom === true) {
    const availableTypes = MACHINE_TYPES.filter((m) => m.startsWith(updatedConfig.machineSeries.toLowerCase()));
    if (availableTypes.length > 0) {
      updatedConfig.machineType = availableTypes[0];
      const specs = getMachineTypeSpecs(availableTypes[0]);
      updatedConfig.vcpus = specs.vcpus;
      updatedConfig.memory = specs.memory;
    }
  }

  const costs = calculateRealCost(updatedConfig);
  updatedConfig.estimatedCost = costs.estimatedCost;
  updatedConfig.onDemandCost = costs.onDemandCost;
  updatedConfig.savings = costs.savings;

  return updatedConfig;
};

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
    const costs = calculateRealCost(fullConfig)
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
          return updateAndRecalculateConfig(config, updates);
        }
        return config;
      }),
    }));
  },

  updateMultipleConfigurations: (ids, updates) => {
    set((state) => ({
      configurations: state.configurations.map((config) => {
        if (ids.includes(config.id)) {
          return updateAndRecalculateConfig(config, updates);
        }
        return config;
      }),
    }));
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
          machineSeries: 'e2',
          machineType: 'e2-medium',
          vcpus: 2,
          memory: 4,
          operatingSystem: 'Linux',
          runningHours: 730,
          quantity: 2,
          diskType: 'Balanced',
          diskSize: 50,
          hasGpu: false,
          discountModel: 'On-Demand',
        })
        break
      case 'database-server':
        presetConfig = createDefaultConfiguration({
          machineSeries: 'n2',
          machineType: 'n2-standard-4',
          vcpus: 4,
          memory: 16,
          operatingSystem: 'Linux',
          runningHours: 730,
          quantity: 1,
          diskType: 'SSD',
          diskSize: 200,
          hasGpu: false,
          discountModel: '1-Year CUD',
        })
        break
      case 'compute-intensive':
        presetConfig = createDefaultConfiguration({
          machineSeries: 'a2',
          machineType: 'a2-highgpu-1g',
          vcpus: 12,
          memory: 85,
          operatingSystem: 'Linux',
          runningHours: 200,
          quantity: 1,
          diskType: 'Balanced',
          diskSize: 100,
          hasGpu: true,
          gpuType: 'nvidia-tesla-a100',
          gpuCount: 1,
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
      'Operating System',
      'vCPUs',
      'Memory (GB)',
      'Running Hours',
      'Quantity',
      'Has GPU',
      'GPU Type',
      'GPU Count',
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
        config.operatingSystem,
        config.vcpus,
        config.memory,
        config.runningHours,
        config.quantity,
        config.hasGpu,
        config.gpuType || '',
        config.gpuCount || '',
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

  intelligentCSVMapping: async (csvData: string) => {
    const parsedData = parseCSV(csvData)
    if (parsedData.length === 0) return []
    
    const headers = Object.keys(parsedData[0])
    const fieldMapping = await intelligentFieldMapping(headers)
    
    return parsedData.map(row => {
      const mappedConfig: any = {}
      
      // Apply intelligent field mapping
      for (const [targetField, sourceHeader] of Object.entries(fieldMapping)) {
        if (row[sourceHeader]) {
          const transformedValue = transformValue(row[sourceHeader], targetField)
          if (transformedValue !== null) {
            mappedConfig[targetField] = transformedValue
          }
        }
      }
      
      // Fill in defaults for missing fields
      const defaultConfig = createDefaultConfiguration()
      const finalConfig = { ...defaultConfig, ...mappedConfig }
      
      return finalConfig
    })
  },

  importFromCSV: async (csvData: string) => {
    try {
      const mappedConfigurations = await get().intelligentCSVMapping(csvData)
      
      // Add all configurations
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
})) 

// Example of how to use the store:
// const { configurations, addConfiguration } = useVmStore.getState()
// addConfiguration({ region: 'us-east1', ... })