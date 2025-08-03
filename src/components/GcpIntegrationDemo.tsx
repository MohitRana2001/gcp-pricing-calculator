"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Code,
  Search,
  Copy,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";
import {
  openOfficialCalculatorForResearch,
  analyzeGcpUrl,
  generateGcpCalculatorUrl,
  generateBulkUrl,
  getMockVmConfigs,
  testUrlGeneration,
} from "@/lib/gcpUrlGenerator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function GcpIntegrationDemo() {
  const [testUrl, setTestUrl] = useState(
    "https://cloud.google.com/products/calculator?hl=en&dl=CiRkNzk2Mjk0Yy1kN2RlLTQwZWUtYTliZC0wM2RmYmQzNDA4MjMQHBokQjA1Qjk4NDAtMTA5MC00NzlGLTk5QzItQzk4MzE1MDk1OEVD"
  );
  const [analysisResults, setAnalysisResults] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(
    "Click 'Generate URL' to see preview..."
  );

  // Generate preview URL on component mount
  React.useEffect(() => {
    const generatePreview = async () => {
      try {
        const url = await generateBulkUrl(getMockVmConfigs());
        setPreviewUrl(url);
      } catch (error) {
        setPreviewUrl("Error generating preview URL");
      }
    };
    generatePreview();
  }, []);

  const handleUrlAnalysis = () => {
    // Capture console output
    const originalLog = console.log;
    let output = "";
    console.log = (...args) => {
      output += args.join(" ") + "\n";
      originalLog(...args);
    };

    analyzeGcpUrl(testUrl);

    // Restore console.log
    console.log = originalLog;
    setAnalysisResults(output);
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const mockConfigs = getMockVmConfigs();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">GCP Calculator Integration Demo</h1>
        <p className="text-muted-foreground">
          Test and research the Google Cloud Pricing Calculator integration
        </p>
        <Badge variant="outline" className="mt-2">
          Development & Research Tool
        </Badge>
      </div>

      {/* Research Phase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Phase 1: URL Structure Research
          </CardTitle>
          <CardDescription>
            Analyze how the official GCP calculator encodes its configuration
            data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => openOfficialCalculatorForResearch()}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Official Calculator
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.open(
                  "https://cloud.google.com/products/calculator",
                  "_blank"
                );
              }}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Test URL to Analyze:</label>
            <div className="flex gap-2">
              <Input
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="Paste GCP calculator URL here..."
                className="flex-1"
              />
              <Button onClick={handleUrlAnalysis} variant="outline">
                <Code className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </div>
          </div>

          {analysisResults && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Analysis Results:</label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopyToClipboard(analysisResults)}
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-64">
                {analysisResults}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* URL Generation Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Phase 2: URL Generation Testing
          </CardTitle>
          <CardDescription>
            Test current implementation with mock data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => testUrlGeneration(mockConfigs)}
              className="w-full"
            >
              <Code className="h-4 w-4 mr-2" />
              Test URL Generation
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const url = await generateBulkUrl(mockConfigs);
                  window.open(url, "_blank");
                } catch (error) {
                  console.error("Failed to generate URL:", error);
                }
              }}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Generated URL
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const url = await generateBulkUrl(mockConfigs);
                  handleCopyToClipboard(url);
                } catch (error) {
                  console.error("Failed to generate URL:", error);
                }
              }}
              className="w-full"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Generated URL
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Generated URL Preview:
            </label>
            <div className="bg-muted p-3 rounded-lg text-sm break-all">
              {previewUrl}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Mock Configuration Data:
            </label>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-48">
              {JSON.stringify(mockConfigs, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Research Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Research Instructions
          </CardTitle>
          <CardDescription>
            Step-by-step guide to complete the integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">
                1
              </Badge>
              <div>
                <p className="font-medium">Open Official Calculator</p>
                <p className="text-sm text-muted-foreground">
                  Click "Open Official Calculator" and create a simple VM
                  configuration
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">
                2
              </Badge>
              <div>
                <p className="font-medium">Generate Share Link</p>
                <p className="text-sm text-muted-foreground">
                  Look for "Share" button or shareable URL in the official
                  calculator
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">
                3
              </Badge>
              <div>
                <p className="font-medium">Analyze URL Structure</p>
                <p className="text-sm text-muted-foreground">
                  Paste the share URL above and click "Analyze" to decode its
                  structure
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">
                4
              </Badge>
              <div>
                <p className="font-medium">Update Implementation</p>
                <p className="text-sm text-muted-foreground">
                  Modify `src/lib/gcpUrlGenerator.ts` based on the discovered
                  URL pattern
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">
                5
              </Badge>
              <div>
                <p className="font-medium">Test & Validate</p>
                <p className="text-sm text-muted-foreground">
                  Use "Test URL Generation" to verify your implementation works
                  correctly
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status & Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Current Status & Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">
              Infrastructure and UI components ready
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">URL structure research needed</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">
              Implementation pending research results
            </span>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Next Step:</strong> Use this demo to research the official
              GCP calculator's URL structure, then update the implementation in{" "}
              <code>gcpUrlGenerator.ts</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
