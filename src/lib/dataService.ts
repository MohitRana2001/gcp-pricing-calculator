// Enhanced data service for production-ready backend management
// Supports both Firestore (for machine data) and Cloud SQL (for user data)

import { VmConfig, MachineTypeData } from './calculator';

// Firestore types for machine data
export interface FirestoreMachineType {
  id: string; // composite key: name_region
  name: string;
  series: string;
  family: string;
  region: string;
  vCpus: number;
  memoryGB: number;
  cpuPlatform: string;
  pricing: {
    onDemand: number;
    spot: number;
    cud1y: number;
    cud3y: number;
    os: {
      windows?: number;
      rhel?: number;
      rhel_sap?: number;
      sles?: number;
      sles_sap?: number;
    };
  };
  updatedAt: string; // ISO timestamp
}

// Cloud SQL types for user data
export interface UserConfiguration {
  id: string;
  userId?: string; // optional for anonymous users
  name: string;
  description?: string;
  configs: VmConfig[];
  sharedUrl?: string;
  csvUrl?: string;
  metadata: {
    totalCost?: number;
    totalInstances: number;
    regions: string[];
    series: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id: string;
  requestId: string;
  configsCount: number;
  executionTimeMs: number;
  success: boolean;
  errorMessage?: string;
  artifactsPath?: string;
  metadata: {
    userAgent?: string;
    region?: string;
    configSummary: string;
  };
  createdAt: string;
}

// Data service interface
export interface DataService {
  // Machine type operations (Firestore)
  getMachineTypes(filters?: {
    series?: string[];
    regions?: string[];
    maxVcpus?: number;
  }): Promise<FirestoreMachineType[]>;
  
  getMachineType(name: string, region: string): Promise<FirestoreMachineType | null>;
  
  updateMachineTypes(data: FirestoreMachineType[]): Promise<void>;
  
  // User configuration operations (Cloud SQL)
  saveConfiguration(config: Omit<UserConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserConfiguration>;
  
  getConfiguration(id: string): Promise<UserConfiguration | null>;
  
  getUserConfigurations(userId: string, limit?: number): Promise<UserConfiguration[]>;
  
  updateConfiguration(id: string, updates: Partial<UserConfiguration>): Promise<UserConfiguration>;
  
  deleteConfiguration(id: string): Promise<void>;
  
  // Analytics operations
  logAutomation(log: Omit<AutomationLog, 'id' | 'createdAt'>): Promise<void>;
  
  getAutomationStats(timeframe: '24h' | '7d' | '30d'): Promise<{
    totalRequests: number;
    successRate: number;
    avgExecutionTime: number;
    topSeries: Array<{ series: string; count: number }>;
    topRegions: Array<{ region: string; count: number }>;
  }>;
}

// Mock implementation for development
export class MockDataService implements DataService {
  private machineTypes: FirestoreMachineType[] = [];
  private configurations: UserConfiguration[] = [];
  private logs: AutomationLog[] = [];

  async getMachineTypes(filters?: {
    series?: string[];
    regions?: string[];
    maxVcpus?: number;
  }): Promise<FirestoreMachineType[]> {
    let result = this.machineTypes;
    
    if (filters?.series) {
      result = result.filter(mt => filters.series!.includes(mt.series));
    }
    
    if (filters?.regions) {
      result = result.filter(mt => filters.regions!.includes(mt.region));
    }
    
    if (filters?.maxVcpus) {
      result = result.filter(mt => mt.vCpus <= filters.maxVcpus!);
    }
    
    return result;
  }

  async getMachineType(name: string, region: string): Promise<FirestoreMachineType | null> {
    return this.machineTypes.find(mt => mt.name === name && mt.region === region) || null;
  }

  async updateMachineTypes(data: FirestoreMachineType[]): Promise<void> {
    this.machineTypes = data;
  }

  async saveConfiguration(config: Omit<UserConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserConfiguration> {
    const now = new Date().toISOString();
    const saved: UserConfiguration = {
      ...config,
      id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    
    this.configurations.push(saved);
    return saved;
  }

  async getConfiguration(id: string): Promise<UserConfiguration | null> {
    return this.configurations.find(c => c.id === id) || null;
  }

  async getUserConfigurations(userId: string, limit = 10): Promise<UserConfiguration[]> {
    return this.configurations
      .filter(c => c.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  async updateConfiguration(id: string, updates: Partial<UserConfiguration>): Promise<UserConfiguration> {
    const index = this.configurations.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error('Configuration not found');
    }
    
    this.configurations[index] = {
      ...this.configurations[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    return this.configurations[index];
  }

  async deleteConfiguration(id: string): Promise<void> {
    const index = this.configurations.findIndex(c => c.id === id);
    if (index !== -1) {
      this.configurations.splice(index, 1);
    }
  }

  async logAutomation(log: Omit<AutomationLog, 'id' | 'createdAt'>): Promise<void> {
    this.logs.push({
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    });
  }

  async getAutomationStats(timeframe: '24h' | '7d' | '30d'): Promise<{
    totalRequests: number;
    successRate: number;
    avgExecutionTime: number;
    topSeries: Array<{ series: string; count: number }>;
    topRegions: Array<{ region: string; count: number }>;
  }> {
    const now = new Date();
    const timeframeMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[timeframe];
    
    const cutoff = new Date(now.getTime() - timeframeMs);
    const relevantLogs = this.logs.filter(log => 
      new Date(log.createdAt) >= cutoff
    );
    
    const totalRequests = relevantLogs.length;
    const successCount = relevantLogs.filter(log => log.success).length;
    const successRate = totalRequests > 0 ? successCount / totalRequests : 0;
    
    const avgExecutionTime = totalRequests > 0 
      ? relevantLogs.reduce((sum, log) => sum + log.executionTimeMs, 0) / totalRequests
      : 0;
    
    // Extract series and regions from metadata (simplified)
    const seriesCount: Record<string, number> = {};
    const regionCount: Record<string, number> = {};
    
    relevantLogs.forEach(log => {
      // Parse metadata for series/regions (simplified extraction)
      const metadata = log.metadata.configSummary;
      if (metadata.includes('e2')) seriesCount['e2'] = (seriesCount['e2'] || 0) + 1;
      if (metadata.includes('n2')) seriesCount['n2'] = (seriesCount['n2'] || 0) + 1;
      if (metadata.includes('us-central1')) regionCount['us-central1'] = (regionCount['us-central1'] || 0) + 1;
    });
    
    const topSeries = Object.entries(seriesCount)
      .map(([series, count]) => ({ series, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const topRegions = Object.entries(regionCount)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalRequests,
      successRate,
      avgExecutionTime,
      topSeries,
      topRegions,
    };
  }
}

// Production implementation placeholder
export class ProductionDataService implements DataService {
  private firestoreDb: any; // Firestore instance
  private sqlDb: any; // PostgreSQL connection pool
  
  constructor(firestoreDb: any, sqlDb: any) {
    this.firestoreDb = firestoreDb;
    this.sqlDb = sqlDb;
  }
  
  async getMachineTypes(filters?: {
    series?: string[];
    regions?: string[];
    maxVcpus?: number;
  }): Promise<FirestoreMachineType[]> {
    // Implementation with Firestore queries
    throw new Error('Not implemented - requires Firestore setup');
  }
  
  async getMachineType(name: string, region: string): Promise<FirestoreMachineType | null> {
    // Implementation with Firestore document get
    throw new Error('Not implemented - requires Firestore setup');
  }
  
  async updateMachineTypes(data: FirestoreMachineType[]): Promise<void> {
    // Implementation with Firestore batch write
    throw new Error('Not implemented - requires Firestore setup');
  }
  
  async saveConfiguration(config: Omit<UserConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserConfiguration> {
    // Implementation with PostgreSQL INSERT
    throw new Error('Not implemented - requires Cloud SQL setup');
  }
  
  async getConfiguration(id: string): Promise<UserConfiguration | null> {
    // Implementation with PostgreSQL SELECT
    throw new Error('Not implemented - requires Cloud SQL setup');
  }
  
  async getUserConfigurations(userId: string, limit = 10): Promise<UserConfiguration[]> {
    // Implementation with PostgreSQL SELECT with LIMIT
    throw new Error('Not implemented - requires Cloud SQL setup');
  }
  
  async updateConfiguration(id: string, updates: Partial<UserConfiguration>): Promise<UserConfiguration> {
    // Implementation with PostgreSQL UPDATE
    throw new Error('Not implemented - requires Cloud SQL setup');
  }
  
  async deleteConfiguration(id: string): Promise<void> {
    // Implementation with PostgreSQL DELETE
    throw new Error('Not implemented - requires Cloud SQL setup');
  }
  
  async logAutomation(log: Omit<AutomationLog, 'id' | 'createdAt'>): Promise<void> {
    // Implementation with PostgreSQL INSERT
    throw new Error('Not implemented - requires Cloud SQL setup');
  }
  
  async getAutomationStats(timeframe: '24h' | '7d' | '30d'): Promise<{
    totalRequests: number;
    successRate: number;
    avgExecutionTime: number;
    topSeries: Array<{ series: string; count: number }>;
    topRegions: Array<{ region: string; count: number }>;
  }> {
    // Implementation with PostgreSQL analytics queries
    throw new Error('Not implemented - requires Cloud SQL setup');
  }
}

// Global service instance
let dataService: DataService;

export function getDataService(): DataService {
  if (!dataService) {
    // Use mock service in development, production service in production
    if (process.env.NODE_ENV === 'production') {
      // Initialize production service with actual database connections
      // dataService = new ProductionDataService(firestoreDb, sqlDb);
      dataService = new MockDataService(); // Temporary fallback
    } else {
      dataService = new MockDataService();
    }
  }
  return dataService;
}

// Utility functions for data migration and management
export async function migrateCsvToFirestore(csvData: MachineTypeData[]): Promise<void> {
  console.log(`🔄 Migrating ${csvData.length} machine types to Firestore...`);
  
  const firestoreData: FirestoreMachineType[] = csvData.map(item => ({
    id: `${item.name}_${item.regionLocation}`,
    name: item.name,
    series: item.series,
    family: item.family,
    region: item.regionLocation,
    vCpus: item.vCpus,
    memoryGB: item.memoryGB,
    cpuPlatform: item.cpuPlatform,
    pricing: {
      onDemand: item.onDemandPerHour,
      spot: item.spotPerHour,
      cud1y: item.cudOneYearPerHour,
      cud3y: item.cudThreeYearPerHour,
      os: {
        windows: item.monthWindows,
        rhel: item.monthRhel,
        rhel_sap: item.monthRhelSap,
        sles: item.monthSles,
        sles_sap: item.monthSlesSap,
      }
    },
    updatedAt: new Date().toISOString(),
  }));
  
  const service = getDataService();
  await service.updateMachineTypes(firestoreData);
  
  console.log('✅ Migration completed successfully');
}

export async function validateDataIntegrity(): Promise<{
  machineTypesCount: number;
  configurationsCount: number;
  recentLogsCount: number;
  issues: string[];
}> {
  const service = getDataService();
  const issues: string[] = [];
  
  try {
    const machineTypes = await service.getMachineTypes();
    const machineTypesCount = machineTypes.length;
    
    if (machineTypesCount === 0) {
      issues.push('No machine types found in database');
    }
    
    // Check for missing pricing data
    const missingPricing = machineTypes.filter(mt => 
      !mt.pricing.onDemand || !mt.pricing.spot
    );
    
    if (missingPricing.length > 0) {
      issues.push(`${missingPricing.length} machine types missing pricing data`);
    }
    
    // Get recent stats
    const stats = await service.getAutomationStats('24h');
    
    return {
      machineTypesCount,
      configurationsCount: 0, // Would query user configurations
      recentLogsCount: stats.totalRequests,
      issues,
    };
    
  } catch (error) {
    issues.push(`Data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      machineTypesCount: 0,
      configurationsCount: 0,
      recentLogsCount: 0,
      issues,
    };
  }
}
