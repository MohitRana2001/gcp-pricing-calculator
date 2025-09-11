"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Trash2,
  Plus,
  Settings,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useVmStore, LinkLoadingState } from "@/store/vmStore";
import {
  REGIONS,
  MACHINE_SERIES,
  MEMORY_CONFIGS,
  VmConfig,
  seriesSupportsCustom,
  seriesSupportsExtendedMemory,
  seriesHasPredefinedVcpus,
  getValidVcpuValues,
  getNextValidVcpu,
  getAllowedMemoryRange,
  getAvailableMachineTypes,
  getPricing,
  findMatchingMachineType,
} from "@/lib/calculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditingCell {
  configId: string;
  field: string;
}

type CommitmentType = "none" | "1-year" | "3-years";

export default function SpreadsheetCalculator() {
  const {
    configurations,
    selectedIds,
    dataLoaded,
    loadingLinks,
    addConfiguration,
    removeConfiguration,
    updateConfiguration,
    duplicateConfiguration,
    toggleSelection,
    selectAll,
    clearSelection,
    exportToCSV,
    importFromCSV,
    initializeData,
    setLinkLoadingState,
  } = useVmStore();

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dataLoaded) {
      initializeData();
    }
  }, [dataLoaded, initializeData]);

  const isAllSelected =
    configurations.length > 0 && selectedIds.size === configurations.length;
  const isIndeterminate =
    selectedIds.size > 0 && selectedIds.size < configurations.length;

  const handleAddConfiguration = () => {
    addConfiguration({
      name: "n2d-highcpu-8",
      series: "n2d",
      family: "General-purpose",
      description: "2 vCPUs 8 GB RAM",
      regionLocation: "asia-south1",
      vCpus: 8,
      cpuPlatform: "Intel Cascade Lake",
      memoryGB: 8,
      isCustom: false,
      onDemandPerHour: 0.067123,
      cudOneYearPerHour: 0.04363,
      cudThreeYearPerHour: 0.030205,
      spotPerHour: 0.013425,
      runningHours: 730,
      quantity: 1,
      os: "linux",
      sqlLicense: "none",
      provisioningModel: "regular",
      commitment: "none",
    });
  };

  const handleCellClick = (configId: string, field: string) => {
    setEditingCell({ configId, field });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleInputChange = (
    configId: string,
    field: string,
    value: string | number | boolean
  ) => {
    updateConfiguration(configId, { [field]: value });
  };

  const handleGenerateLink = async (
    config: VmConfig,
    commitment: CommitmentType,
    enableDebug: boolean = false
  ) => {
    const linkTypeMap: Record<CommitmentType, keyof LinkLoadingState> = {
      none: "onDemand",
      "1-year": "oneYear",
      "3-years": "threeYear",
    };
    const linkType = linkTypeMap[commitment];

    setLinkLoadingState(config.id, linkType, true);
    try {
      const configWithCommitment = {
        ...config,
        commitment: commitment,
      };

      const response = await fetch("/api/generate-gcp-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configurations: [configWithCommitment],
          commitment: commitment,
          options: {
            debug: enableDebug,
            timeout: 60000,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate link");
      }

      const result = await response.json();
      if (result.success && result.shareUrl) {
        const linkUpdate = {
          ...config.links,
          [linkType]: result.shareUrl,
        };
        updateConfiguration(config.id, { links: linkUpdate });
        toast.success(
          `Successfully generated ${commitment} link for ${config.name}`
        );
      } else {
        throw new Error(result.error || "API did not return a shareable URL.");
      }
    } catch (error) {
      console.error(`Failed to generate ${commitment} link:`, error);
      toast.error(
        `Failed to generate ${commitment} link: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setLinkLoadingState(config.id, linkType, false);
    }
  };

  // Parallel link generation for all commitment types
  const handleGenerateAllLinks = async (
    config: VmConfig,
    enableDebug: boolean = false
  ) => {
    const commitmentTypes: CommitmentType[] = ["none", "1-year", "3-years"];
    const linkTypeMap: Record<CommitmentType, keyof LinkLoadingState> = {
      none: "onDemand",
      "1-year": "oneYear",
      "3-years": "threeYear",
    };

    // Set all loading states to true
    commitmentTypes.forEach((commitment) => {
      setLinkLoadingState(config.id, linkTypeMap[commitment], true);
    });

    try {
      // Generate all links in parallel
      const promises = commitmentTypes.map(async (commitment) => {
        try {
          // Using console.log for debugging, toast would be too noisy for each parallel request

          // Create an enhanced config with the commitment information
          const configWithCommitment = {
            ...config,
            commitment: commitment,
          };

          const response = await fetch("/api/generate-gcp-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              configurations: [configWithCommitment],
              commitment: commitment,
              options: {
                debug: enableDebug,
                timeout: 60000,
              },
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to generate link");
          }

          const result = await response.json();
          if (result.success && result.shareUrl) {
            return { commitment, url: result.shareUrl, success: true };
          } else {
            throw new Error(
              result.error || "API did not return a shareable URL."
            );
          }
        } catch (error) {
          console.error(`Failed to generate ${commitment} link:`, error);
          return {
            commitment,
            url: null,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      // Wait for all requests to complete
      const results = await Promise.all(promises);

      // Update links based on results
      const linkUpdates: Partial<VmConfig["links"]> = { ...config.links };
      let successCount = 0;
      let errorMessages: string[] = [];

      results.forEach((result) => {
        const linkType = linkTypeMap[result.commitment];
        if (result.success && result.url) {
          (linkUpdates as any)[linkType] = result.url;
          successCount++;
        } else {
          errorMessages.push(
            `${result.commitment}: ${result.error || "Failed"}`
          );
        }
      });

      // Update configuration with successful links
      if (successCount > 0) {
        updateConfiguration(config.id, { links: linkUpdates });
      }

      // Show summary
      if (successCount === commitmentTypes.length) {
        toast.success(
          `Successfully generated all ${successCount} links for ${config.name}!`
        );
      } else if (successCount > 0) {
        toast.warning(
          `Generated ${successCount}/${commitmentTypes.length} links for ${config.name}`,
          {
            description: `Errors: ${errorMessages.join("; ")}`,
            duration: 6000,
          }
        );
      } else {
        toast.error(`Failed to generate any links for ${config.name}`, {
          description: `Errors: ${errorMessages.join("; ")}`,
          duration: 6000,
        });
      }
    } catch (error) {
      console.error("Error in parallel link generation:", error);
      toast.error(`Error generating links for ${config.name}`, {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 6000,
      });
    } finally {
      // Clear all loading states
      commitmentTypes.forEach((commitment) => {
        setLinkLoadingState(config.id, linkTypeMap[commitment], false);
      });
    }
  };

  const handleVcpuMemoryChange = (
    configId: string,
    field: "vCpus" | "memoryGB",
    value: number
  ) => {
    const config = configurations.find((c) => c.id === configId);
    if (!config) return;

    const newVcpus = field === "vCpus" ? value : config.vCpus;
    const newMemoryGB = field === "memoryGB" ? value : config.memoryGB;

    const matchingType = findMatchingMachineType(
      config.series,
      config.regionLocation,
      newVcpus,
      newMemoryGB
    );

    if (matchingType) {
      updateConfiguration(configId, {
        isCustom: false,
        name: matchingType.name,
        vCpus: matchingType.vCpus,
        memoryGB: matchingType.memoryGB,
        description: matchingType.description,
        cpuPlatform: matchingType.cpuPlatform,
        onDemandPerHour: matchingType.onDemandPerHour,
        cudOneYearPerHour: matchingType.cudOneYearPerHour,
        cudThreeYearPerHour: matchingType.cudThreeYearPerHour,
        spotPerHour: matchingType.spotPerHour,
      });
    } else {
      // No matching type found, set to custom and auto-adjust if needed
      let adjustedVcpus = newVcpus;
      let adjustedMemoryGB = newMemoryGB;

      const memoryRange = getAllowedMemoryRange(config.series, adjustedVcpus);

      if (field === "vCpus") {
        if (adjustedMemoryGB < memoryRange.min) {
          adjustedMemoryGB = memoryRange.min;
        } else if (adjustedMemoryGB > memoryRange.max) {
          adjustedMemoryGB = memoryRange.max;
        }
        adjustedMemoryGB = Math.round(adjustedMemoryGB / 0.25) * 0.25;
      } else if (field === "memoryGB") {
        if (adjustedMemoryGB < memoryRange.min) {
          adjustedMemoryGB = memoryRange.min;
        } else if (adjustedMemoryGB > memoryRange.max) {
          adjustedMemoryGB = memoryRange.max;
        }
        adjustedMemoryGB = Math.round(adjustedMemoryGB / 0.25) * 0.25;
      }

      const updates: Partial<VmConfig> = {
        vCpus: adjustedVcpus,
        memoryGB: adjustedMemoryGB,
        isCustom: true,
        name: "custom",
        description: `${adjustedVcpus} vCPUs ${adjustedMemoryGB} GB RAM`,
      };

      if (seriesSupportsExtendedMemory(config.series)) {
        const seriesConfig = MEMORY_CONFIGS[config.series];
        const standardMemoryLimit =
          adjustedVcpus * seriesConfig.maxMemoryPerVcpu;
        if (adjustedMemoryGB > standardMemoryLimit) {
          updates.extendedMemoryEnabled = true;
        } else {
          updates.extendedMemoryEnabled = false;
        }
      } else {
        updates.extendedMemoryEnabled = false;
      }

      updateConfiguration(configId, updates);
    }
  };

  const handleMasterCheckboxChange = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll();
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
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Bulk link generation for selected configurations
  const handleGenerateBulkLinks = async (enableDebug: boolean = false) => {
    const selectedConfigs = configurations.filter((config) =>
      selectedIds.has(config.id)
    );

    if (selectedConfigs.length === 0) {
      toast.warning(
        "Please select at least one configuration to generate bulk links."
      );
      return;
    }

    const commitmentTypes: CommitmentType[] = ["none", "1-year", "3-years"];
    const linkTypeMap: Record<CommitmentType, keyof LinkLoadingState> = {
      none: "onDemand",
      "1-year": "oneYear",
      "3-years": "threeYear",
    };

    // Set loading states for all selected configs
    selectedConfigs.forEach((config) => {
      commitmentTypes.forEach((commitment) => {
        setLinkLoadingState(config.id, linkTypeMap[commitment], true);
      });
    });

    try {
      toast.info(
        `Starting bulk link generation for ${selectedConfigs.length} configurations...`
      );

      // Create all promises for parallel execution
      const allPromises = selectedConfigs.flatMap((config) =>
        commitmentTypes.map(async (commitment) => {
          try {
            // Create an enhanced config with the commitment information
            const configWithCommitment = {
              ...config,
              commitment: commitment,
            };

            const response = await fetch("/api/generate-gcp-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                configurations: [configWithCommitment],
                commitment: commitment,
                options: {
                  debug: enableDebug,
                  timeout: 60000,
                },
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Failed to generate link");
            }

            const result = await response.json();
            if (result.success && result.shareUrl) {
              return {
                configId: config.id,
                commitment,
                url: result.shareUrl,
                success: true,
                configName: config.name,
              };
            } else {
              throw new Error(
                result.error || "API did not return a shareable URL."
              );
            }
          } catch (error) {
            console.error(
              `Failed to generate ${commitment} link for ${config.name}:`,
              error
            );
            return {
              configId: config.id,
              commitment,
              url: null,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              configName: config.name,
            };
          }
        })
      );

      // Execute all promises in parallel (keeping console.log for debugging)
      const results = await Promise.all(allPromises);

      // Process results and update configurations
      const linkUpdates: Record<string, Partial<VmConfig["links"]>> = {};
      let totalSuccessCount = 0;
      let totalErrorCount = 0;
      const errorsByConfig: Record<string, string[]> = {};

      results.forEach((result) => {
        const linkType = linkTypeMap[result.commitment];

        if (!linkUpdates[result.configId]) {
          linkUpdates[result.configId] = {};
        }

        if (result.success && result.url) {
          (linkUpdates[result.configId] as any)[linkType] = result.url;
          totalSuccessCount++;
        } else {
          if (!errorsByConfig[result.configId]) {
            errorsByConfig[result.configId] = [];
          }
          errorsByConfig[result.configId].push(
            `${result.commitment}: ${result.error || "Failed"}`
          );
          totalErrorCount++;
        }
      });

      // Update all configurations with successful links
      Object.entries(linkUpdates).forEach(([configId, links]) => {
        const config = configurations.find((c) => c.id === configId);
        if (config && links && Object.keys(links).length > 0) {
          updateConfiguration(configId, {
            links: { ...config.links, ...links },
          });
        }
      });

      // Show detailed summary
      const totalRequests = selectedConfigs.length * commitmentTypes.length;
      if (totalSuccessCount === totalRequests) {
        toast.success(
          `Bulk generation complete! Successfully generated all ${totalSuccessCount} links for ${selectedConfigs.length} configurations.`,
          { duration: 5000 }
        );
      } else if (totalSuccessCount > 0) {
        const errorDetails = Object.entries(errorsByConfig)
          .map(([configId, errors]) => {
            const config = configurations.find((c) => c.id === configId);
            return `${config?.name || "Unknown"}: ${errors.join(", ")}`;
          })
          .join("\n");

        toast.warning(`Bulk generation completed with partial success!`, {
          description: `Success: ${totalSuccessCount}/${totalRequests} links. Errors: ${totalErrorCount}`,
          duration: 8000,
        });
      } else {
        const errorDetails = Object.entries(errorsByConfig)
          .map(([configId, errors]) => {
            const config = configurations.find((c) => c.id === configId);
            return `${config?.name || "Unknown"}: ${errors.join(", ")}`;
          })
          .join("\n");

        toast.error(`Bulk generation failed for all configurations.`, {
          description: "Check console for detailed error information",
          duration: 8000,
        });
      }
    } catch (error) {
      console.error("Error in bulk link generation:", error);
      toast.error("Error in bulk link generation", {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 8000,
      });
    } finally {
      // Clear all loading states
      selectedConfigs.forEach((config) => {
        commitmentTypes.forEach((commitment) => {
          setLinkLoadingState(config.id, linkTypeMap[commitment], false);
        });
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getMemoryValidationInfo = (config: VmConfig) => {
    if (!config.isCustom) {
      return null;
    }

    const range = getAllowedMemoryRange(config.series, config.vCpus);
    return {
      min: range.min,
      max: range.max,
      isValid: config.memoryGB >= range.min && config.memoryGB <= range.max,
    };
  };

  if (!dataLoaded) {
    return (
      <div className="w-full flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading machine data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">VM Configurations</h2>
          {selectedIds.size > 0 && (
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk Generation Button */}
          <Button
            variant="default"
            onClick={() => handleGenerateBulkLinks()}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2"
          >
            Generate Bulk Links
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            style={{ display: "none" }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            Import CSV
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="flex items-center gap-2"
          >
            Export CSV
          </Button>
          <Button
            onClick={handleAddConfiguration}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Configuration
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-12 p-3 text-left">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleMasterCheckboxChange}
                    className={
                      isIndeterminate
                        ? "data-[state=indeterminate]:bg-primary"
                        : ""
                    }
                  />
                </th>
                <th className="w-24 p-3 text-left font-semibold">Actions</th>
                <th className="min-w-[200px] p-3 text-left font-semibold">
                  Region Location
                </th>
                <th className="min-w-[100px] p-3 text-left font-semibold">
                  Series
                </th>
                <th className="min-w-[80px] p-3 text-left font-semibold">
                  Custom
                </th>
                <th className="min-w-[200px] p-3 text-left font-semibold">
                  Machine Type
                </th>
                <th className="min-w-[80px] p-3 text-left font-semibold">
                  vCPUs
                </th>
                <th className="min-w-[120px] p-3 text-left font-semibold">
                  Memory (GB)
                </th>
                <th className="min-w-[200px] p-3 text-left font-semibold">
                  Description
                </th>
                <th className="min-w-[160px] p-3 text-left font-semibold">
                  CPU Platform
                </th>
                <th className="min-w-[130px] p-3 text-left font-semibold">
                  Running Hours
                </th>
                <th className="min-w-[100px] p-3 text-left font-semibold">
                  Quantity
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  OS
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  SQL License
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  Provisioning
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  On-Demand
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  RCUD - 1yr
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  RCUD - 3yr
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  OS On-Demand
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  OS 1-Year CUD
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  OS 3-Year CUD
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  SQL License Cost
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  On-Demand Inclusive
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  1-Year CUD Inclusive
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  3-Year CUD Inclusive
                </th>
                <th className="min-w-[200px] p-3 text-left font-semibold">
                  On-Demand Link
                </th>
                <th className="min-w-[200px] p-3 text-left font-semibold">
                  1-Year CUD Link
                </th>
                <th className="min-w-[200px] p-3 text-left font-semibold">
                  3-Year CUD Link
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {configurations.map((config) => {
                  const memoryInfo = getMemoryValidationInfo(config);
                  const availableTypes = getAvailableMachineTypes(
                    config.series,
                    config.regionLocation
                  );
                  const pricing = getPricing(config);
                  const currentLoading = loadingLinks[config.id] || {
                    onDemand: false,
                    oneYear: false,
                    threeYear: false,
                  };
                  const supportsCustom = seriesSupportsCustom(config.series);

                  return (
                    <motion.tr
                      key={config.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className={`border-t hover:bg-muted/25 transition-colors ${
                        selectedIds.has(config.id) ? "bg-muted/50" : ""
                      }`}
                      onMouseEnter={() => setHoveredRow(config.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {/* Checkbox */}
                      <td className="p-3">
                        <Checkbox
                          checked={selectedIds.has(config.id)}
                          onCheckedChange={() => toggleSelection(config.id)}
                        />
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        <div className={`flex gap-1 transition-opacity`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => duplicateConfiguration(config.id)}
                            title="Duplicate configuration"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700"
                            onClick={() => handleGenerateAllLinks(config)}
                            title="Generate all links in parallel"
                            disabled={
                              currentLoading.onDemand ||
                              currentLoading.oneYear ||
                              currentLoading.threeYear
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeConfiguration(config.id)}
                            title="Delete configuration"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>

                      {/* Region Location */}
                      <td className="p-3">
                        <Select
                          value={config.regionLocation}
                          onValueChange={(value) =>
                            handleInputChange(
                              config.id,
                              "regionLocation",
                              value
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REGIONS.map((region) => (
                              <SelectItem key={region} value={region}>
                                {region}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Series */}
                      <td className="p-3">
                        <Select
                          value={config.series}
                          onValueChange={(value) => {
                            const availableTypes = getAvailableMachineTypes(
                              value,
                              config.regionLocation
                            );
                            const newSeriesSupportsCustom =
                              seriesSupportsCustom(value);

                            if (availableTypes.length > 0) {
                              const firstType = availableTypes[0];
                              updateConfiguration(config.id, {
                                series: value,
                                name: firstType.name,
                                vCpus: firstType.vCpus,
                                memoryGB: firstType.memoryGB,
                                description: firstType.description,
                                cpuPlatform: firstType.cpuPlatform,
                                onDemandPerHour: firstType.onDemandPerHour,
                                cudOneYearPerHour: firstType.cudOneYearPerHour,
                                cudThreeYearPerHour:
                                  firstType.cudThreeYearPerHour,
                                spotPerHour: firstType.spotPerHour,
                                // If the new series doesn't support custom, force isCustom to false
                                isCustom: newSeriesSupportsCustom
                                  ? config.isCustom
                                  : false,
                              });
                            } else {
                              updateConfiguration(config.id, {
                                series: value,
                                // Also handle this edge case
                                isCustom: newSeriesSupportsCustom
                                  ? config.isCustom
                                  : false,
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MACHINE_SERIES.map((series) => (
                              <SelectItem key={series} value={series}>
                                {series.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Custom Toggle */}
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={config.isCustom}
                          disabled={!supportsCustom}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            if (isChecked) {
                              updateConfiguration(config.id, {
                                isCustom: true,
                                name: "custom",
                              });
                            } else {
                              const matchingType = findMatchingMachineType(
                                config.series,
                                config.regionLocation,
                                config.vCpus,
                                config.memoryGB
                              );

                              if (matchingType) {
                                updateConfiguration(config.id, {
                                  isCustom: false,
                                  name: matchingType.name,
                                  description: matchingType.description,
                                  cpuPlatform: matchingType.cpuPlatform,
                                  onDemandPerHour: matchingType.onDemandPerHour,
                                  cudOneYearPerHour:
                                    matchingType.cudOneYearPerHour,
                                  cudThreeYearPerHour:
                                    matchingType.cudThreeYearPerHour,
                                  spotPerHour: matchingType.spotPerHour,
                                });
                              } else {
                                const availableTypes = getAvailableMachineTypes(
                                  config.series,
                                  config.regionLocation
                                );
                                if (availableTypes.length > 0) {
                                  const firstType = availableTypes[0];
                                  updateConfiguration(config.id, {
                                    isCustom: false,
                                    name: firstType.name,
                                    vCpus: firstType.vCpus,
                                    memoryGB: firstType.memoryGB,
                                    description: firstType.description,
                                    cpuPlatform: firstType.cpuPlatform,
                                    onDemandPerHour: firstType.onDemandPerHour,
                                    cudOneYearPerHour:
                                      firstType.cudOneYearPerHour,
                                    cudThreeYearPerHour:
                                      firstType.cudThreeYearPerHour,
                                    spotPerHour: firstType.spotPerHour,
                                  });
                                }
                              }
                            }
                          }}
                        />
                      </td>

                      {/* Machine Type */}
                      <td className="p-3">
                        <Select
                          value={config.name}
                          disabled={config.isCustom}
                          onValueChange={(value) => {
                            if (value === "custom") {
                              updateConfiguration(config.id, {
                                isCustom: true,
                                name: "custom",
                              });
                            } else {
                              const selectedType = availableTypes.find(
                                (t) => t.name === value
                              );
                              if (selectedType) {
                                updateConfiguration(config.id, {
                                  isCustom: false,
                                  name: selectedType.name,
                                  vCpus: selectedType.vCpus,
                                  memoryGB: selectedType.memoryGB,
                                  description: selectedType.description,
                                  cpuPlatform: selectedType.cpuPlatform,
                                  onDemandPerHour: selectedType.onDemandPerHour,
                                  cudOneYearPerHour:
                                    selectedType.cudOneYearPerHour,
                                  cudThreeYearPerHour:
                                    selectedType.cudThreeYearPerHour,
                                  spotPerHour: selectedType.spotPerHour,
                                });
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value="custom"
                              disabled={!supportsCustom}
                            >
                              Custom
                            </SelectItem>
                            {availableTypes.map((type) => (
                              <SelectItem key={type.name} value={type.name}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* vCPUs */}
                      <td className="p-3">
                        {(() => {
                          const seriesConfig = MEMORY_CONFIGS[config.series];
                          const maxVcpus = seriesConfig
                            ? seriesConfig.maxVcpus
                            : 96;
                          const minVcpus = 2;
                          const validVcpus = getValidVcpuValues(config.series);
                          const hasPredefinedVcpus = seriesHasPredefinedVcpus(
                            config.series
                          );

                          return editingCell?.configId === config.id &&
                            editingCell?.field === "vCpus" ? (
                            <Input
                              type="text"
                              value={config.vCpus}
                              onChange={(e) => {
                                // Allow empty string during typing
                                if (e.target.value === "") {
                                  handleVcpuMemoryChange(config.id, "vCpus", 0);
                                  return;
                                }

                                // Only allow numeric input
                                const numericValue = e.target.value.replace(
                                  /[^0-9]/g,
                                  ""
                                );
                                if (numericValue !== e.target.value) {
                                  return; // Prevent non-numeric characters
                                }

                                const rawValue = parseInt(numericValue, 10);
                                if (isNaN(rawValue)) return;

                                // For real-time validation, just cap at maximum to allow typing multi-digit numbers
                                const cappedValue = Math.min(
                                  rawValue,
                                  maxVcpus
                                );
                                handleVcpuMemoryChange(
                                  config.id,
                                  "vCpus",
                                  cappedValue
                                );
                              }}
                              onBlur={() => {
                                let finalValue = config.vCpus;

                                if (hasPredefinedVcpus) {
                                  // For series with predefined vCPUs (like N2D), find the closest valid value
                                  if (!validVcpus.includes(finalValue)) {
                                    finalValue = getNextValidVcpu(
                                      config.series,
                                      finalValue
                                    );
                                  }
                                } else {
                                  // For other series, apply standard validation
                                  if (finalValue < minVcpus) {
                                    finalValue = minVcpus;
                                  }

                                  if (finalValue % 2 !== 0) {
                                    finalValue = Math.max(
                                      minVcpus,
                                      finalValue - 1
                                    );
                                  }
                                }

                                if (finalValue !== config.vCpus) {
                                  handleVcpuMemoryChange(
                                    config.id,
                                    "vCpus",
                                    finalValue
                                  );
                                }
                                handleCellBlur();
                              }}
                              onFocus={(e) => {
                                // Select all text when focused for easy replacement
                                e.target.select();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  (e.target as HTMLInputElement).blur();
                              }}
                              className="h-8 text-sm"
                              disabled={!supportsCustom}
                              autoFocus
                              placeholder={
                                hasPredefinedVcpus
                                  ? `Valid: ${validVcpus.join(", ")}`
                                  : `${minVcpus}-${maxVcpus} (even numbers)`
                              }
                            />
                          ) : (
                            <button
                              onClick={() =>
                                handleCellClick(config.id, "vCpus")
                              }
                              disabled={!supportsCustom}
                              className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {config.vCpus}
                            </button>
                          );
                        })()}
                      </td>

                      {/* Memory (GB) */}
                      <td className="p-3">
                        {editingCell?.configId === config.id &&
                        editingCell?.field === "memoryGB" ? (
                          <div>
                            <Input
                              type="text"
                              value={config.memoryGB}
                              onChange={(e) => {
                                // Allow empty string during typing
                                if (e.target.value === "") {
                                  handleVcpuMemoryChange(
                                    config.id,
                                    "memoryGB",
                                    0
                                  );
                                  return;
                                }

                                // Only allow numeric input with optional decimal point
                                const numericValue = e.target.value.replace(
                                  /[^0-9.]/g,
                                  ""
                                );
                                // Ensure only one decimal point
                                const parts = numericValue.split(".");
                                if (parts.length > 2) {
                                  return; // More than one decimal point
                                }

                                if (numericValue !== e.target.value) {
                                  return; // Prevent non-numeric characters
                                }

                                const rawValue = parseFloat(numericValue);
                                const maxMemory = memoryInfo?.max || 384;

                                if (isNaN(rawValue)) return;
                                const cappedValue = Math.min(
                                  rawValue,
                                  maxMemory
                                );
                                handleVcpuMemoryChange(
                                  config.id,
                                  "memoryGB",
                                  cappedValue
                                );
                              }}
                              onBlur={() => {
                                if (!memoryInfo) {
                                  handleCellBlur();
                                  return;
                                }
                                let finalValue = config.memoryGB;
                                const { min } = memoryInfo;

                                if (finalValue < min) {
                                  finalValue = min;
                                }

                                finalValue =
                                  Math.round(finalValue / 0.25) * 0.25;
                                finalValue = Math.max(min, finalValue);

                                if (finalValue !== config.memoryGB) {
                                  handleVcpuMemoryChange(
                                    config.id,
                                    "memoryGB",
                                    finalValue
                                  );
                                }
                                handleCellBlur();
                              }}
                              onFocus={(e) => {
                                // Select all text when focused for easy replacement
                                e.target.select();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  (e.target as HTMLInputElement).blur();
                              }}
                              className={`h-8 text-sm ${
                                memoryInfo && !memoryInfo.isValid
                                  ? "border-red-500"
                                  : ""
                              }`}
                              disabled={!supportsCustom}
                              autoFocus
                              placeholder={`${memoryInfo?.min || 1}-${
                                memoryInfo?.max || 384
                              } GB (0.25 increments)`}
                            />
                            {memoryInfo && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Range: {memoryInfo.min}-{memoryInfo.max} GB
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              handleCellClick(config.id, "memoryGB")
                            }
                            disabled={!supportsCustom}
                            className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-1">
                              {config.memoryGB}
                              {memoryInfo && !memoryInfo.isValid && (
                                <span className="text-red-500 text-xs">⚠️</span>
                              )}
                            </div>
                            {seriesSupportsExtendedMemory(config.series) &&
                              config.isCustom && (
                                <div className="text-xs text-muted-foreground">
                                  {memoryInfo &&
                                    `${memoryInfo.min}-${memoryInfo.max}`}
                                </div>
                              )}
                          </button>
                        )}
                      </td>

                      {/* Description */}
                      <td className="p-3">
                        <div className="text-sm text-muted-foreground">
                          {config.description}
                        </div>
                      </td>

                      {/* CPU Platform */}
                      <td className="p-3">
                        <div className="text-xs text-muted-foreground">
                          {config.cpuPlatform}
                        </div>
                      </td>

                      {/* Running Hours */}
                      <td className="p-3">
                        {editingCell?.configId === config.id &&
                        editingCell?.field === "runningHours" ? (
                          <Input
                            type="text"
                            value={config.runningHours}
                            onChange={(e) => {
                              // Allow empty string during typing
                              if (e.target.value === "") {
                                handleInputChange(config.id, "runningHours", 1);
                                return;
                              }

                              // Only allow numeric input
                              const numericValue = e.target.value.replace(
                                /[^0-9]/g,
                                ""
                              );
                              if (numericValue !== e.target.value) {
                                return; // Prevent non-numeric characters
                              }

                              const value = parseInt(numericValue) || 1;
                              const cappedValue = Math.min(value, 744);
                              handleInputChange(
                                config.id,
                                "runningHours",
                                cappedValue
                              );
                            }}
                            onBlur={() => {
                              // Ensure minimum value on blur
                              if (config.runningHours < 1) {
                                handleInputChange(config.id, "runningHours", 1);
                              }
                              handleCellBlur();
                            }}
                            onFocus={(e) => {
                              // Select all text when focused for easy replacement
                              e.target.select();
                            }}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleCellBlur()
                            }
                            className="h-8 text-sm"
                            autoFocus
                            placeholder="1-744 hours"
                          />
                        ) : (
                          <button
                            onClick={() =>
                              handleCellClick(config.id, "runningHours")
                            }
                            className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full"
                          >
                            {config.runningHours}
                          </button>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="p-3">
                        {editingCell?.configId === config.id &&
                        editingCell?.field === "quantity" ? (
                          <Input
                            type="text"
                            value={config.quantity}
                            onChange={(e) => {
                              // Allow empty string during typing
                              if (e.target.value === "") {
                                handleInputChange(config.id, "quantity", 1);
                                return;
                              }

                              // Only allow numeric input
                              const numericValue = e.target.value.replace(
                                /[^0-9]/g,
                                ""
                              );
                              if (numericValue !== e.target.value) {
                                return; // Prevent non-numeric characters
                              }

                              const value = parseInt(numericValue) || 1;
                              const cappedValue = Math.min(value, 1000);
                              handleInputChange(
                                config.id,
                                "quantity",
                                cappedValue
                              );
                            }}
                            onBlur={() => {
                              // Ensure minimum value on blur
                              if (config.quantity < 1) {
                                handleInputChange(config.id, "quantity", 1);
                              }
                              handleCellBlur();
                            }}
                            onFocus={(e) => {
                              // Select all text when focused for easy replacement
                              e.target.select();
                            }}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleCellBlur()
                            }
                            className="h-8 text-sm"
                            autoFocus
                            placeholder="1-1000"
                          />
                        ) : (
                          <button
                            onClick={() =>
                              handleCellClick(config.id, "quantity")
                            }
                            className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full"
                          >
                            {config.quantity}
                          </button>
                        )}
                      </td>

                      {/* OS */}
                      <td className="p-3">
                        <Select
                          value={config.os}
                          onValueChange={(value) =>
                            handleInputChange(config.id, "os", value)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="linux">Linux</SelectItem>
                            <SelectItem value="windows">Windows</SelectItem>
                            <SelectItem value="rhel">RHEL</SelectItem>
                            <SelectItem value="rhel_sap">
                              RHEL for SAP
                            </SelectItem>
                            <SelectItem value="sles">SLES</SelectItem>
                            <SelectItem value="sles_sap">
                              SLES for SAP
                            </SelectItem>
                            <SelectItem value="ubuntu_pro">
                              Ubuntu Pro
                            </SelectItem>
                            <SelectItem value="rhel_7_els">
                              RHEL 7 ELS add-on
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* SQL License */}
                      <td className="p-3">
                        <Select
                          value={config.sqlLicense}
                          onValueChange={(value) =>
                            handleInputChange(config.id, "sqlLicense", value)
                          }
                          disabled={config.os !== "windows"}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="enterprise">
                              SQL Server Enterprise
                            </SelectItem>
                            <SelectItem value="standard">
                              SQL Server Standard
                            </SelectItem>
                            <SelectItem value="web">SQL Server Web</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Provisioning */}
                      <td className="p-3">
                        <Select
                          value={
                            config.provisioningModel ||
                            (config.provisioningModel === "spot"
                              ? "spot"
                              : "regular")
                          }
                          onValueChange={(value) => {
                            updateConfiguration(config.id, {
                              provisioningModel: value as any,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="spot">Spot</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* On-Demand */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(pricing.onDemand)}
                        </div>
                      </td>

                      {/* CUD 1-Year */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(pricing.cud1y)}
                        </div>
                      </td>

                      {/* CUD 3-Year */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(pricing.cud3y)}
                        </div>
                      </td>

                      {/* OS On-Demand */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(pricing.osOnDemand)}
                        </div>
                      </td>

                      {/* OS 1-Year CUD */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(pricing.os1yCud)}
                        </div>
                      </td>

                      {/* OS 3-Year CUD */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(pricing.os3yCud)}
                        </div>
                      </td>

                      {/* SQL License Cost */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(pricing.sqlLicenseCost)}
                        </div>
                      </td>

                      {/* On-Demand Inclusive */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(pricing.onDemandInclusive)}
                        </div>
                      </td>

                      {/* 1-Year CUD Inclusive */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(Number(pricing.cud1yInclusive))}
                        </div>
                      </td>

                      {/* 3-Year CUD Inclusive */}
                      <td className="p-3">
                        <div className="text-sm">
                          {formatCurrency(Number(pricing.cud3yInclusive))}
                        </div>
                      </td>

                      {/* On-Demand Link */}
                      <td className="p-3">
                        <LinkCell
                          config={config}
                          commitment="none"
                          loading={currentLoading.onDemand}
                          onGenerate={handleGenerateLink}
                        />
                      </td>
                      {/* 1-Year CUD Link */}
                      <td className="p-3">
                        <LinkCell
                          config={config}
                          commitment="1-year"
                          loading={currentLoading.oneYear}
                          onGenerate={handleGenerateLink}
                        />
                      </td>
                      {/* 3-Year CUD Link */}
                      <td className="p-3">
                        <LinkCell
                          config={config}
                          commitment="3-years"
                          loading={currentLoading.threeYear}
                          onGenerate={handleGenerateLink}
                        />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {configurations.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <div className="mb-4">
              <Plus className="h-12 w-12 mx-auto opacity-50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No configurations yet
            </h3>
            <p className="mb-4">
              Start by adding your first VM configuration or use a preset from
              the sidebar.
            </p>
            <Button onClick={handleAddConfiguration}>
              Add Your First Configuration
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for the link cells
function LinkCell({
  config,
  commitment,
  loading,
  onGenerate,
}: {
  config: VmConfig;
  commitment: CommitmentType;
  loading: boolean;
  onGenerate: (config: VmConfig, commitment: CommitmentType) => void;
}) {
  const linkTypeMap = {
    none: "onDemand" as const,
    "1-year": "oneYear" as const,
    "3-years": "threeYear" as const,
  };
  const link = config.links?.[linkTypeMap[commitment]];

  if (link) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm truncate"
          title={link}
          style={{ maxWidth: "150px" }}
        >
          View Link
        </a>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={() => navigator.clipboard.writeText(link)}
          title="Copy link"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      disabled={loading}
      onClick={() => onGenerate(config, commitment)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
    </Button>
  );
}
