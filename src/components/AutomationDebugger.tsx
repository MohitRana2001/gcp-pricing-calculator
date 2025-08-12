"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  generateGcpCalculatorUrlDebug,
  checkServiceHealth,
  getMockVmConfigs,
} from "@/lib/gcpUrlGenerator";
import { createTestVmConfig } from "@/lib/gcpConfigAdapter";

export default function AutomationDebugger() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [enableScreenshots, setEnableScreenshots] = useState(true);
  const [stepByStep, setStepByStep] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
    setTimeout(() => {
      logsRef.current?.scrollTop = logsRef.current?.scrollHeight;
    }, 100);
  };

  const clearLogs = () => {
    setLogs([]);
    setResult("");
    setError("");
  };

  const runDiagnostics = async () => {
    setLoading(true);
    clearLogs();

    try {
      addLog("🔍 Starting automation diagnostics...");

      // 1. Check service health
      addLog("📡 Checking API service health...");
      const isHealthy = await checkServiceHealth();
      addLog(
        `📡 Service health: ${isHealthy ? "✅ Healthy" : "❌ Not responding"}`
      );

      if (!isHealthy) {
        throw new Error(
          "API service is not responding. Please check if the server is running."
        );
      }

      // 2. Test configuration validation
      addLog("📋 Testing configuration validation...");
      const testConfig = createTestVmConfig();
      addLog(
        `📋 Test config created: ${testConfig.name} in ${testConfig.regionLocation}`
      );

      // 3. Run automation with debug mode
      addLog("🎭 Starting Playwright automation in debug mode...");
      addLog("⚠️ Browser window will open - DO NOT CLOSE IT manually");

      const startTime = Date.now();

      // Override console.log temporarily to capture automation logs
      const originalLog = console.log;
      console.log = (...args) => {
        addLog(`🤖 ${args.join(" ")}`);
        originalLog(...args);
      };

      try {
        const url = await generateGcpCalculatorUrlDebug([testConfig], true);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        addLog(`✅ Automation completed in ${duration}s`);
        addLog(`🔗 Generated URL: ${url}`);
        setResult(url);

        // Test the URL
        addLog("🧪 Testing generated URL...");
        if (url.includes("cloud.google.com/products/calculator")) {
          addLog("✅ URL format looks correct");
        } else {
          addLog("⚠️ URL format might be incorrect");
        }
      } finally {
        console.log = originalLog;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      addLog(`❌ Diagnostics failed: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const testSpecificScenarios = async () => {
    setLoading(true);
    clearLogs();

    try {
      addLog("🧪 Testing specific scenarios...");

      // Test with different provisioning models
      const scenarios = [
        {
          ...createTestVmConfig(),
          provisioningModel: "Regular" as const,
          discountModel: "On-Demand",
        },
        {
          ...createTestVmConfig(),
          provisioningModel: "Spot" as const,
          discountModel: "Spot VM",
        },
        { ...createTestVmConfig(), discountModel: "1-Year CUD" },
      ];

      for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        addLog(
          `📝 Testing scenario ${i + 1}: ${
            scenario.provisioningModel || "Legacy"
          } - ${scenario.discountModel}`
        );

        try {
          const url = await generateGcpCalculatorUrlDebug([scenario], false);
          addLog(`✅ Scenario ${i + 1} passed: ${url.substring(0, 80)}...`);
        } catch (error) {
          addLog(
            `❌ Scenario ${i + 1} failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }

        // Add delay between scenarios
        if (i < scenarios.length - 1) {
          addLog("⏳ Waiting 2 seconds before next scenario...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      addLog("🎉 Scenario testing completed");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      addLog(`❌ Scenario testing failed: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🔧</span>
          Automation Debugger & Diagnostics
        </CardTitle>
        <p className="text-sm text-gray-600">
          Debug and troubleshoot the GCP Calculator automation system
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Debug Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="screenshots"
              checked={enableScreenshots}
              onCheckedChange={(checked) =>
                setEnableScreenshots(checked as boolean)
              }
            />
            <label htmlFor="screenshots" className="text-sm">
              Enable screenshot capture
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="stepByStep"
              checked={stepByStep}
              onCheckedChange={(checked) => setStepByStep(checked as boolean)}
            />
            <label htmlFor="stepByStep" className="text-sm">
              Step-by-step mode (slower but more detailed)
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={runDiagnostics}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Running..." : "🔍 Run Full Diagnostics"}
          </Button>

          <Button
            onClick={testSpecificScenarios}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? "Testing..." : "🧪 Test Scenarios"}
          </Button>

          <Button
            onClick={clearLogs}
            disabled={loading}
            variant="ghost"
            className="w-full"
          >
            🗑️ Clear Logs
          </Button>
        </div>

        {/* Real-time Logs */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Real-time Logs</h3>
          <div
            ref={logsRef}
            className="bg-black text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm"
          >
            {logs.length === 0 ? (
              <div className="text-gray-500">
                No logs yet. Click a button above to start debugging.
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <Alert className="bg-green-50 border-green-200">
            <div className="flex items-start gap-2">
              <Badge className="bg-green-100 text-green-800">Success</Badge>
              <div className="flex-1">
                <p className="text-sm">Generated URL:</p>
                <a
                  href={result}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm break-all"
                >
                  {result}
                </a>
              </div>
            </div>
          </Alert>
        )}

        {error && (
          <Alert className="bg-red-50 border-red-200">
            <div className="flex items-start gap-2">
              <Badge variant="destructive">Error</Badge>
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </Alert>
        )}

        {/* Troubleshooting Guide */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">
            🛠️ Troubleshooting Guide
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • <strong>Service not responding:</strong> Ensure the Next.js
              server is running
            </li>
            <li>
              • <strong>Browser automation fails:</strong> Run `npm run
              setup:playwright` to install browsers
            </li>
            <li>
              • <strong>Timeout errors:</strong> GCP Calculator UI might have
              changed
            </li>
            <li>
              • <strong>URL format incorrect:</strong> Check the share button
              automation logic
            </li>
            <li>
              • <strong>Screenshots not captured:</strong> Check /artifacts
              directory permissions
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
