"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  Link,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { generateBulkUrl } from "@/lib/gcpUrlGenerator";
import { VmConfig } from "@/lib/calculator";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GcpUrlGeneratorButtonsProps {
  configurations: VmConfig[];
}

export default function GcpUrlGeneratorButtons({
  configurations,
}: GcpUrlGeneratorButtonsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateUrl = async () => {
    if (configurations.length === 0) {
      setError("No configurations available to generate URL");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedUrl(null);

    try {
      console.log(
        `🚀 Starting URL generation for ${configurations.length} configurations...`
      );
      const url = await generateBulkUrl(configurations);

      setGeneratedUrl(url);
      console.log("✅ URL generated successfully:", url);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate URL";
      setError(errorMessage);
      console.error("❌ URL generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenUrl = async () => {
    if (generatedUrl) {
      window.open(generatedUrl, "_blank");
    } else {
      await handleGenerateUrl();
      // URL will be opened after generation completes if successful
    }
  };

  const handleCopyUrl = async () => {
    let urlToCopy = generatedUrl;

    if (!urlToCopy) {
      try {
        setIsGenerating(true);
        urlToCopy = await generateBulkUrl(configurations);
        setGeneratedUrl(urlToCopy);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate URL");
        setIsGenerating(false);
        return;
      } finally {
        setIsGenerating(false);
      }
    }

    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      setError("Failed to copy URL to clipboard");
    }
  };

  const getEstimatedTime = () => {
    // Rough estimate: 10-30 seconds per configuration
    const timePerConfig = 20; // seconds
    const totalTime = configurations.length * timePerConfig;

    if (totalTime < 60) {
      return `~${totalTime}s`;
    } else {
      const minutes = Math.round(totalTime / 60);
      return `~${minutes}m`;
    }
  };

  return (
    <div className="space-y-3">
      {/* Main Action Buttons */}
      <div className="grid grid-cols-1 gap-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleOpenUrl}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating URL...
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open All Configs in GCP Calculator
            </>
          )}
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleCopyUrl}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : copied ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Link className="h-4 w-4 mr-2" />
              Copy Bulk Share Link
            </>
          )}
        </Button>
      </div>

      {/* Status Messages */}
      {isGenerating && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Automating browser to fill GCP calculator... This may take{" "}
            {getEstimatedTime()} for {configurations.length} configuration
            {configurations.length !== 1 ? "s" : ""}.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {generatedUrl && !isGenerating && !error && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div>GCP Calculator URL generated successfully!</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(generatedUrl, "_blank")}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                  <Link className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* URL Preview (for development) */}
      {generatedUrl && process.env.NODE_ENV === "development" && (
        <div className="mt-3 p-2 bg-muted rounded text-xs">
          <div className="font-medium mb-1">Generated URL:</div>
          <div className="break-all">{generatedUrl}</div>
        </div>
      )}
    </div>
  );
}
