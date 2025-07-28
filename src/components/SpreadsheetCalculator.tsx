"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Trash2, Plus } from "lucide-react";
import { useVmStore } from "@/store/vmStore";
import {
  REGIONS,
  MACHINE_SERIES,
  MACHINE_TYPES,
  DISK_TYPES,
  DISCOUNT_MODELS,
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

export default function SpreadsheetCalculator() {
  const {
    configurations,
    selectedIds,
    addConfiguration,
    removeConfiguration,
    updateConfiguration,
    duplicateConfiguration,
    toggleSelection,
    selectAll,
    clearSelection,
  } = useVmStore();

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const isAllSelected =
    configurations.length > 0 && selectedIds.size === configurations.length;
  const isIndeterminate =
    selectedIds.size > 0 && selectedIds.size < configurations.length;

  const handleAddConfiguration = () => {
    addConfiguration({
      name: "New Configuration",
      region: "us-central1",
      machineSeries: "E2",
      machineType: "e2-standard-2",
      isCustom: false,
      vcpus: 2,
      memory: 8,
      diskType: "Balanced",
      diskSize: 50,
      discountModel: "On-Demand",
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
    value: string | number
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">VM Configurations</h2>
          {selectedIds.size > 0 && (
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
          )}
        </div>
        <Button
          onClick={handleAddConfiguration}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Configuration
        </Button>
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
                <th className="min-w-[150px] p-3 text-left font-semibold">
                  Name
                </th>
                <th className="min-w-[120px] p-3 text-left font-semibold">
                  Region
                </th>
                <th className="min-w-[100px] p-3 text-left font-semibold">
                  Series
                </th>
                <th className="min-w-[140px] p-3 text-left font-semibold">
                  Machine Type
                </th>
                <th className="min-w-[80px] p-3 text-left font-semibold">
                  vCPU
                </th>
                <th className="min-w-[100px] p-3 text-left font-semibold">
                  Memory (GB)
                </th>
                <th className="min-w-[100px] p-3 text-left font-semibold">
                  Disk Type
                </th>
                <th className="min-w-[100px] p-3 text-left font-semibold">
                  Disk Size (GB)
                </th>
                <th className="min-w-[120px] p-3 text-left font-semibold">
                  Discount
                </th>
                <th className="min-w-[120px] p-3 text-left font-semibold">
                  Monthly Cost
                </th>
                <th className="w-24 p-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {configurations.map((config) => (
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

                    {/* Name */}
                    <td className="p-3">
                      {editingCell?.configId === config.id &&
                      editingCell?.field === "name" ? (
                        <Input
                          value={config.name}
                          onChange={(e) =>
                            handleInputChange(config.id, "name", e.target.value)
                          }
                          onBlur={handleCellBlur}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleCellBlur()
                          }
                          className="h-8 text-sm"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => handleCellClick(config.id, "name")}
                          className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full"
                        >
                          {config.name}
                        </button>
                      )}
                    </td>

                    {/* Region */}
                    <td className="p-3">
                      <Select
                        value={config.region}
                        onValueChange={(value) =>
                          handleInputChange(config.id, "region", value)
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
                        value={config.machineSeries}
                        onValueChange={(value) =>
                          handleInputChange(config.id, "machineSeries", value)
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MACHINE_SERIES.map((series) => (
                            <SelectItem key={series} value={series}>
                              {series}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Machine Type */}
                    <td className="p-3">
                      <Select
                        value={config.machineType}
                        onValueChange={(value) =>
                          handleInputChange(config.id, "machineType", value)
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(MACHINE_TYPES[config.machineSeries] || []).map(
                            (type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* vCPU */}
                    <td className="p-3">
                      {editingCell?.configId === config.id &&
                      editingCell?.field === "vcpus" ? (
                        <Input
                          type="number"
                          value={config.vcpus}
                          onChange={(e) =>
                            handleInputChange(
                              config.id,
                              "vcpus",
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
                          onClick={() => handleCellClick(config.id, "vcpus")}
                          className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full"
                        >
                          {config.vcpus}
                        </button>
                      )}
                    </td>

                    {/* Memory */}
                    <td className="p-3">
                      {editingCell?.configId === config.id &&
                      editingCell?.field === "memory" ? (
                        <Input
                          type="number"
                          value={config.memory}
                          onChange={(e) =>
                            handleInputChange(
                              config.id,
                              "memory",
                              parseInt(e.target.value) || 1
                            )
                          }
                          onBlur={handleCellBlur}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleCellBlur()
                          }
                          className="h-8 text-sm"
                          min="1"
                          max="384"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => handleCellClick(config.id, "memory")}
                          className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full"
                        >
                          {config.memory}
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
                          onClick={() => handleCellClick(config.id, "diskSize")}
                          className="text-left hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 transition-colors w-full"
                        >
                          {config.diskSize}
                        </button>
                      )}
                    </td>

                    {/* Discount */}
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
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      <div
                        className={`flex gap-1 transition-opacity ${
                          hoveredRow === config.id ? "opacity-100" : "opacity-0"
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
                      </div>
                    </td>
                  </motion.tr>
                ))}
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
