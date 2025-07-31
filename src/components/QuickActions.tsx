"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import {
  Server,
  Database,
  Cpu,
  Copy,
  Trash2,
  CheckSquare,
  Square,
  Upload,
  Download,
  BarChart3,
  DollarSign,
  Layers,
  TrendingDown,
  Zap,
  Globe,
  Cog,
} from "lucide-react";
import { useVmStore } from "@/store/vmStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REGIONS, MACHINE_SERIES } from "@/lib/calculator";

export default function QuickActions() {
  const {
    selectedIds,
    addPresetConfiguration,
    removeMultipleConfigurations,
    duplicateMultipleConfigurations,
    updateMultipleConfigurations,
    clearSelection,
    getTotalConfigurations,
    getAverageCost,
    getTotalSavings,
    getTotalMonthlyCost,
    importFromCSV,
  } = useVmStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkRegion, setBulkRegion] = useState("");
  const [bulkSeries, setBulkSeries] = useState("");

  const selectedIdsArray = Array.from(selectedIds);
  const hasSelection = selectedIds.size > 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleApplyBulkChanges = () => {
    const updates: { region?: string; machineSeries?: string } = {};
    if (bulkRegion) {
      updates.region = bulkRegion;
    }
    if (bulkSeries) {
      updates.machineSeries = bulkSeries;
    }

    if (Object.keys(updates).length > 0) {
      updateMultipleConfigurations(selectedIdsArray, updates);
    }
  };

  const handleImportCSV = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvData = e.target?.result as string;
        await importFromCSV(csvData);
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const presets = [
    {
      id: "web-server",
      name: "Web Server",
      description: "E2-medium, 50GB balanced disk",
      estimatedCost: "~$24/month",
      icon: Server,
      onClick: () => addPresetConfiguration("web-server"),
    },
    {
      id: "database-server",
      name: "Database Server",
      description: "N2-standard-4, 200GB SSD",
      estimatedCost: "~$89/month",
      icon: Database,
      onClick: () => addPresetConfiguration("database-server"),
    },
    {
      id: "compute-intensive",
      name: "GPU Compute",
      description: "A2-highgpu-1g, Spot pricing",
      estimatedCost: "~$245/month",
      icon: Cpu,
      onClick: () => addPresetConfiguration("compute-intensive"),
    },
  ];

  return (
    <div className="w-80 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5" />
            Quick Presets
          </CardTitle>
          <CardDescription>
            Pre-configured VM templates for common use cases
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {presets.map((preset) => (
            <Button
              key={preset.id}
              variant="outline"
              className="w-full h-auto p-4 justify-start text-left"
              onClick={preset.onClick}
            >
              <div className="flex items-start gap-3 w-full">
                <preset.icon className="h-5 w-5 mt-0.5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{preset.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {preset.description}
                  </div>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {preset.estimatedCost}
                  </Badge>
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckSquare className="h-5 w-5" />
            Bulk Actions
          </CardTitle>
          <CardDescription>
            Perform actions on multiple configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasSelection && (
            <div className="mb-3 p-3 bg-primary/10 rounded-md border border-primary/20">
              <div className="text-sm font-medium text-primary mb-3">
                {selectedIds.size} configuration
                {selectedIds.size > 1 ? "s" : ""} selected
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium flex items-center gap-1 mb-1">
                    <Globe className="h-3 w-3" />
                    Region
                  </label>
                  <Select value={bulkRegion} onValueChange={setBulkRegion}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Apply new region..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium flex items-center gap-1 mb-1">
                    <Cog className="h-3 w-3" />
                    Series
                  </label>
                  <Select value={bulkSeries} onValueChange={setBulkSeries}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Apply new series..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MACHINE_SERIES.map((series) => (
                        <SelectItem key={series} value={series}>
                          {series}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleApplyBulkChanges}
                  disabled={!bulkRegion && !bulkSeries}
                >
                  Apply Changes
                </Button>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={!hasSelection}
            onClick={() => duplicateMultipleConfigurations(selectedIdsArray)}
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicate Selected
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start text-destructive hover:text-destructive"
            disabled={!hasSelection}
            onClick={() => removeMultipleConfigurations(selectedIdsArray)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={!hasSelection}
            onClick={clearSelection}
          >
            <Square className="h-4 w-4 mr-2" />
            Clear Selection
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Statistics
          </CardTitle>
          <CardDescription>
            Real-time overview of your configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center mb-1">
                <Layers className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">
                {getTotalConfigurations()}
              </div>
              <div className="text-xs text-muted-foreground">Total Configs</div>
            </div>

            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center mb-1">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(getAverageCost())}
              </div>
              <div className="text-xs text-muted-foreground">Avg Cost</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-600" />
                <span className="text-sm">Total Savings</span>
              </div>
              <span className="font-semibold text-green-600">
                {formatCurrency(getTotalSavings())}
              </span>
            </div>

            <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Total Monthly</span>
              </div>
              <span className="font-semibold">
                {formatCurrency(getTotalMonthlyCost())}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            Multi-Cloud Comparison
          </CardTitle>
          <CardDescription>
            Compare pricing across cloud providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start text-left opacity-60 cursor-not-allowed"
            disabled
          >
            <div className="flex items-start gap-3 w-full">
              <div className="flex items-center justify-center w-8 h-8 bg-orange-50 rounded-lg border border-orange-200">
                <Image
                  src="/images/icons8-aws.svg"
                  alt="AWS Logo"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Amazon Web Services</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  EC2 pricing comparison
                </div>
                <Badge variant="secondary" className="mt-1 text-xs">
                  Coming Soon
                </Badge>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start text-left opacity-60 cursor-not-allowed"
            disabled
          >
            <div className="flex items-start gap-3 w-full">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-lg border border-blue-200">
                <Image
                  src="/images/icons8-azure.svg"
                  alt="Azure Logo"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Microsoft Azure</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Virtual Machines pricing
                </div>
                <Badge variant="secondary" className="mt-1 text-xs">
                  Coming Soon
                </Badge>
              </div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
