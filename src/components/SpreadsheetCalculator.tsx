"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Trash2, Plus, Settings, ExternalLink } from "lucide-react";
import { useVmStore } from "@/store/vmStore";
import {
  REGIONS,
  MACHINE_SERIES,
  MACHINE_FAMILIES,
  DISK_TYPES,
  DISCOUNT_MODELS,
  seriesSupportsExtendedMemory,
  getAllowedMemoryRange,
  getAvailableMachineTypes,
} from "@/lib/calculator";
import { generateGcpCalculatorUrl } from "@/lib/gcpUrlGenerator";
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

export default function SpreadsheetCalculator() {
  const {
    configurations,
    selectedIds,
    dataLoaded,
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
      name: "e2-standard-2",
      series: "e2",
      family: "General-purpose",
      description: "2 vCPUs 8 GB RAM",
      regionLocation: "us-central1",
      vCpus: 2,
      cpuPlatform: "Intel Cascade Lake",
      memoryGB: 8,
      isCustom: false,
      onDemandPerHour: 0.067123,
      cudOneYearPerHour: 0.04363,
      cudThreeYearPerHour: 0.030205,
      spotPerHour: 0.013425,
      runningHours: 730,
      quantity: 1,
      discountModel: "On-Demand",
      diskType: "Balanced",
      diskSize: 50,
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
    }).format(amount);
  };

  const getMemoryValidationInfo = (config: any) => {
    if (!config.isCustom || !seriesSupportsExtendedMemory(config.series)) {
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
                <th className="min-w-[100px] p-3 text-left font-semibold">
                  Series
                </th>
                <th className="min-w-[140px] p-3 text-left font-semibold">
                  Family
                </th>
                <th className="min-w-[200px] p-3 text-left font-semibold">
                  Description
                </th>
                <th className="min-w-[140px] p-3 text-left font-semibold">
                  Region Location
                </th>
                <th className="min-w-[80px] p-3 text-left font-semibold">
                  vCPUs
                </th>
                <th className="min-w-[160px] p-3 text-left font-semibold">
                  CPU Platform
                </th>
                <th className="min-w-[120px] p-3 text-left font-semibold">
                  Memory (GB)
                </th>
                <th className="min-w-[80px] p-3 text-left font-semibold">
                  Custom
                </th>
                <th className="min-w-[130px] p-3 text-left font-semibold">
                  Running Hours
                </th>
                <th className="min-w-[100px] p-3 text-left font-semibold">
                  Quantity
                </th>
                <th className="min-w-[120px] p-3 text-left font-semibold">
                  Disk Type
                </th>
                <th className="min-w-[130px] p-3 text-left font-semibold">
                  Disk Size (GB)
                </th>
                <th className="min-w-[140px] p-3 text-left font-semibold">
                  Discount Model
                </th>
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  Monthly Cost
                </th>
                <th className="w-24 p-3 text-left font-semibold">Actions</th>
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

                      {/* Series */}
                      <td className="p-3">
                        {config.isCustom ? (
                          <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Custom
                            </span>
                          </div>
                        ) : (
                          <Select
                            value={config.name}
                            onValueChange={(value) => {
                              // Check if it's a series change or machine type change
                              const isSeriesValue =
                                MACHINE_SERIES.includes(value);

                              if (isSeriesValue) {
                                // Series change - update to first available machine type
                                handleInputChange(config.id, "series", value);
                                const availableTypes = getAvailableMachineTypes(
                                  value,
                                  config.regionLocation
                                );
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
                                    cudOneYearPerHour:
                                      firstType.cudOneYearPerHour,
                                    cudThreeYearPerHour:
                                      firstType.cudThreeYearPerHour,
                                    spotPerHour: firstType.spotPerHour,
                                  });
                                }
                              } else {
                                // Machine type change
                                const selectedType = availableTypes.find(
                                  (t) => t.name === value
                                );
                                if (selectedType) {
                                  updateConfiguration(config.id, {
                                    name: selectedType.name,
                                    vCpus: selectedType.vCpus,
                                    memoryGB: selectedType.memoryGB,
                                    description: selectedType.description,
                                    cpuPlatform: selectedType.cpuPlatform,
                                    onDemandPerHour:
                                      selectedType.onDemandPerHour,
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
                              <SelectValue
                                placeholder={config.series.toUpperCase()}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Series Options */}
                              <SelectItem value={config.series}>
                                <div className="flex items-center gap-2 font-semibold text-primary">
                                  {seriesSupportsExtendedMemory(
                                    config.series
                                  ) && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Ext
                                    </Badge>
                                  )}
                                  {config.series.toUpperCase()} Series
                                </div>
                              </SelectItem>

                              {/* Available Machine Types */}
                              {availableTypes.map((type) => (
                                <SelectItem key={type.name} value={type.name}>
                                  <div className="pl-4 text-sm">
                                    {type.name}
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({type.vCpus}vCPU, {type.memoryGB}GB)
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}

                              {/* Other Series */}
                              {MACHINE_SERIES.filter(
                                (s) => s !== config.series
                              ).map((series) => (
                                <SelectItem key={series} value={series}>
                                  <div className="flex items-center gap-2">
                                    {seriesSupportsExtendedMemory(series) && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Ext
                                      </Badge>
                                    )}
                                    {series.toUpperCase()} Series
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>

                      {/* Family */}
                      <td className="p-3">
                        <div className="text-sm">{config.family}</div>
                      </td>

                      {/* Description */}
                      <td className="p-3">
                        <div className="text-sm text-muted-foreground">
                          {config.description}
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

                      {/* vCPUs */}
                      <td className="p-3">
                        {editingCell?.configId === config.id &&
                        editingCell?.field === "vCpus" ? (
                          <Input
                            type="number"
                            value={config.vCpus}
                            onChange={(e) =>
                              handleInputChange(
                                config.id,
                                "vCpus",
                                parseInt(e.target.value) || 1
                              )
                            }
                            onBlur={handleCellBlur}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleCellBlur()
                            }
                            className="h-8 text-sm"
                            min="1"
                            max="96"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => handleCellClick(config.id, "vCpus")}
                            className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full"
                            disabled={!config.isCustom}
                          >
                            {config.vCpus}
                          </button>
                        )}
                      </td>

                      {/* CPU Platform */}
                      <td className="p-3">
                        <div className="text-xs text-muted-foreground">
                          {config.cpuPlatform}
                        </div>
                      </td>

                      {/* Memory (GB) */}
                      <td className="p-3">
                        {editingCell?.configId === config.id &&
                        editingCell?.field === "memoryGB" ? (
                          <div>
                            <Input
                              type="number"
                              value={config.memoryGB}
                              onChange={(e) =>
                                handleInputChange(
                                  config.id,
                                  "memoryGB",
                                  parseFloat(e.target.value) || 1
                                )
                              }
                              onBlur={handleCellBlur}
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleCellBlur()
                              }
                              className={`h-8 text-sm ${
                                memoryInfo && !memoryInfo.isValid
                                  ? "border-red-500"
                                  : ""
                              }`}
                              min={memoryInfo?.min || 1}
                              max={memoryInfo?.max || 384}
                              step="0.25"
                              autoFocus
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
                            className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full"
                            disabled={!config.isCustom}
                          >
                            <div className="flex items-center gap-1">
                              {config.memoryGB}
                              {memoryInfo && !memoryInfo.isValid && (
                                <span className="text-red-500 text-xs">⚠</span>
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

                      {/* Custom Toggle */}
                      <td className="p-3">
                        <Checkbox
                          checked={config.isCustom}
                          onCheckedChange={(checked) =>
                            handleInputChange(config.id, "isCustom", checked)
                          }
                        />
                      </td>

                      {/* Running Hours */}
                      <td className="p-3">
                        {editingCell?.configId === config.id &&
                        editingCell?.field === "runningHours" ? (
                          <Input
                            type="number"
                            value={config.runningHours}
                            onChange={(e) =>
                              handleInputChange(
                                config.id,
                                "runningHours",
                                parseInt(e.target.value) || 1
                              )
                            }
                            onBlur={handleCellBlur}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleCellBlur()
                            }
                            className="h-8 text-sm"
                            min="1"
                            max="744"
                            autoFocus
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
                            type="number"
                            value={config.quantity}
                            onChange={(e) =>
                              handleInputChange(
                                config.id,
                                "quantity",
                                parseInt(e.target.value) || 1
                              )
                            }
                            onBlur={handleCellBlur}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleCellBlur()
                            }
                            className="h-8 text-sm"
                            min="1"
                            max="1000"
                            autoFocus
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

                      {/* Disk Type */}
                      <td className="p-3">
                        <Select
                          value={config.diskType}
                          onValueChange={(value) =>
                            handleInputChange(config.id, "diskType", value)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DISK_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Disk Size */}
                      <td className="p-3">
                        {editingCell?.configId === config.id &&
                        editingCell?.field === "diskSize" ? (
                          <Input
                            type="number"
                            value={config.diskSize}
                            onChange={(e) =>
                              handleInputChange(
                                config.id,
                                "diskSize",
                                parseInt(e.target.value) || 10
                              )
                            }
                            onBlur={handleCellBlur}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleCellBlur()
                            }
                            className="h-8 text-sm"
                            min="10"
                            max="65536"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() =>
                              handleCellClick(config.id, "diskSize")
                            }
                            className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full"
                          >
                            {config.diskSize}
                          </button>
                        )}
                      </td>

                      {/* Discount Model */}
                      <td className="p-3">
                        <Select
                          value={config.discountModel}
                          onValueChange={(value) =>
                            handleInputChange(config.id, "discountModel", value)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DISCOUNT_MODELS.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Monthly Cost */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="font-semibold text-green-600">
                            {formatCurrency(config.estimatedCost)}
                          </div>
                          {config.savings > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Save {formatCurrency(config.savings)}
                            </Badge>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {config.quantity > 1 &&
                              `${config.quantity}x instances`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(config.onDemandPerHour)}/hr
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        <div
                          className={`flex gap-1 transition-opacity ${
                            hoveredRow === config.id
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => duplicateConfiguration(config.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeConfiguration(config.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              try {
                                const { generateGcpCalculatorUrl } =
                                  await import("@/lib/gcpUrlGenerator");
                                const url = await generateGcpCalculatorUrl([
                                  config,
                                ]);
                                window.open(url, "_blank");
                              } catch (error) {
                                console.error(
                                  "Failed to generate GCP URL:",
                                  error
                                );
                                // Fallback to opening the calculator manually
                                window.open(
                                  "https://cloud.google.com/products/calculator",
                                  "_blank"
                                );
                              }
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
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
