"use client";

import React from "react";
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

export default function QuickActions() {
  const {
    configurations,
    selectedIds,
    addPresetConfiguration,
    removeMultipleConfigurations,
    duplicateMultipleConfigurations,
    clearSelection,
    getTotalConfigurations,
    getAverageCost,
    getTotalSavings,
    getTotalMonthlyCost,
  } = useVmStore();

  const selectedIdsArray = Array.from(selectedIds);
  const hasSelection = selectedIds.size > 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
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
      name: "Compute Intensive",
      description: "C3-standard-8, Spot pricing",
      estimatedCost: "~$45/month",
      icon: Cpu,
      onClick: () => addPresetConfiguration("compute-intensive"),
    },
  ];

  return (
    <div className="w-80 space-y-6">
      {/* Quick Presets */}
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
          {presets.map((preset) => {
            const Icon = preset.icon;
            return (
              <Button
                key={preset.id}
                variant="outline"
                className="w-full h-auto p-4 justify-start text-left"
                onClick={preset.onClick}
              >
                <div className="flex items-start gap-3 w-full">
                  <Icon className="h-5 w-5 mt-0.5 text-primary" />
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
            );
          })}
        </CardContent>
      </Card>

      {/* Bulk Actions */}
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
            <div className="mb-3 p-2 bg-primary/10 rounded-md">
              <div className="text-sm font-medium text-primary">
                {selectedIds.size} configuration
                {selectedIds.size > 1 ? "s" : ""} selected
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

      {/* Statistics */}
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

      {/* Import/Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5" />
            Import/Export
          </CardTitle>
          <CardDescription>Bulk data management capabilities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start" disabled>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
            <Badge variant="secondary" className="ml-auto text-xs">
              Coming Soon
            </Badge>
          </Button>

          <Button variant="outline" className="w-full justify-start" disabled>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
            <Badge variant="secondary" className="ml-auto text-xs">
              Coming Soon
            </Badge>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
