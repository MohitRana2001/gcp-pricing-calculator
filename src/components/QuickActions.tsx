"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Server,
  Database,
  HardDrive,
  Upload,
  Download,
  Trash2,
  Copy,
  Users,
  BarChart3,
  DollarSign,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import Image from "next/image";
import { useVmStore, ServiceType } from "@/store/vmStore";
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
    selectedService,
    setSelectedService,
    configurations,
    selectedIds,
    removeMultipleConfigurations,
    duplicateMultipleConfigurations,
    clearSelection,
    exportToCSV,
    importFromCSV,
    getTotalConfigurations,
    getAverageCost,
    getTotalSavings,
    getTotalMonthlyCost,
    getComputeEngineCost,
    getCloudStorageCost,
    getCloudSQLCost,
    getTotalServicesCost,
  } = useVmStore();

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
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleServiceSelect = (service: ServiceType) => {
    setSelectedService(service);
  };

  const services = [
    {
      id: "compute-engine",
      name: "Compute Engine",
      description: "Virtual machines and computing resources",
      icon: Server,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      cost: getComputeEngineCost(),
      configurations: configurations.length,
    },
    {
      id: "cloud-storage",
      name: "Cloud Storage",
      description: "Object storage and file hosting",
      icon: HardDrive,
      color: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      cost: getCloudStorageCost(),
      configurations: 0, // Placeholder
    },
    {
      id: "cloud-sql",
      name: "Cloud SQL",
      description: "Managed relational databases",
      icon: Database,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      cost: getCloudSQLCost(),
      configurations: 0, // Placeholder
    },
  ];

  return (
    <div className="w-80 space-y-6">
      {/* Service Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            GCP Services
          </CardTitle>
          <CardDescription>
            Select a service to configure and estimate costs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 flex-wrap">
          {services.map((service) => {
            const isSelected = selectedService === service.id;
            const hasConfigurations = service.configurations > 0;

            return (
              <motion.div
                key={service.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="outline"
                  className={`w-full justify-start h-auto p-4 relative ${
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleServiceSelect(service.id as ServiceType)}
                >
                  <div
                    className={`p-2 rounded-lg mr-3 ${service.bgColor} ${service.borderColor} border`}
                  >
                    <service.icon className={`h-5 w-5 ${service.color}`} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{service.name}</span>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground break-words text-wrap">
                      {service.description}
                    </div>
                    {hasConfigurations && (
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {service.configurations} configs
                        </Badge>
                        <span className="text-xs font-medium text-green-600">
                          {formatCurrency(service.cost)}/month
                        </span>
                      </div>
                    )}
                    {service.id !== "compute-engine" && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Coming Soon
                      </Badge>
                    )}
                  </div>
                </Button>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cost Summary */}
      {getTotalServicesCost() > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Summary
            </CardTitle>
            <CardDescription>
              Total estimated monthly costs across all services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {getComputeEngineCost() > 0 && (
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Compute Engine</span>
                </div>
                <span className="font-semibold text-blue-600">
                  {formatCurrency(getComputeEngineCost())}
                </span>
              </div>
            )}

            {getCloudStorageCost() > 0 && (
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Cloud Storage</span>
                </div>
                <span className="font-semibold text-green-600">
                  {formatCurrency(getCloudStorageCost())}
                </span>
              </div>
            )}

            {getCloudSQLCost() > 0 && (
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Cloud SQL</span>
                </div>
                <span className="font-semibold text-purple-600">
                  {formatCurrency(getCloudSQLCost())}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
              <span className="text-sm font-semibold">Total Monthly Cost</span>
              <span className="font-bold text-primary text-lg">
                {formatCurrency(getTotalServicesCost())}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions - Only show when Compute Engine is selected and has configurations */}
      {selectedService === "compute-engine" && configurations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Bulk Actions
            </CardTitle>
            <CardDescription>
              Perform actions on multiple selected configurations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="w-full justify-center">
                {selectedIds.size} configurations selected
              </Badge>
            )}

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() =>
                duplicateMultipleConfigurations(Array.from(selectedIds))
              }
              disabled={selectedIds.size === 0}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate Selected
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() =>
                removeMultipleConfigurations(Array.from(selectedIds))
              }
              disabled={selectedIds.size === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={clearSelection}
              disabled={selectedIds.size === 0}
            >
              Clear Selection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Statistics - Only show when Compute Engine is selected and has configurations */}
      {selectedService === "compute-engine" && configurations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Statistics
            </CardTitle>
            <CardDescription>
              Overview of your Compute Engine configurations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {getTotalConfigurations()}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Configs
                </div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(getAverageCost())}
                </div>
                <div className="text-xs text-muted-foreground">
                  Average Cost
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Total Savings
                </span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(getTotalSavings())}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  Monthly Cost
                </span>
                <span className="font-semibold">
                  {formatCurrency(getTotalMonthlyCost())}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import/Export - Only show when Compute Engine is selected */}
      {selectedService === "compute-engine" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import/Export
            </CardTitle>
            <CardDescription>
              Manage your Compute Engine configurations with CSV files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: "none" }}
              id="csv-import"
            />
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => document.getElementById("csv-import")?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={exportToCSV}
              disabled={configurations.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Multi-Cloud Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Multi-Cloud Comparison</CardTitle>
          <CardDescription className="text-xs">
            Compare pricing across cloud providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start h-auto p-3"
            disabled
          >
            <Image
              src="/images/icons8-aws.svg"
              alt="AWS"
              width={20}
              height={20}
              className="mr-3"
            />
            <div className="text-left flex-1">
              <div className="text-sm font-medium">Amazon Web Services</div>
              <Badge variant="secondary" className="text-xs mt-1">
                Coming Soon
              </Badge>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto p-3"
            disabled
          >
            <Image
              src="/images/icons8-azure.svg"
              alt="Azure"
              width={20}
              height={20}
              className="mr-3"
            />
            <div className="text-left flex-1">
              <div className="text-sm font-medium">Microsoft Azure</div>
              <Badge variant="secondary" className="text-xs mt-1">
                Coming Soon
              </Badge>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto p-3"
            disabled
          >
            <Image
              src="/images/icons8-google-cloud.svg"
              alt="Google Cloud"
              width={20}
              height={20}
              className="mr-3"
            />
            <div className="text-left flex-1">
              <div className="text-sm font-medium text-emerald-600">
                Google Cloud Platform
              </div>
              <Badge variant="secondary" className="text-xs mt-1">
                Coming Soon
              </Badge>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
