"use client";

import React from "react";
import { Cloud } from "lucide-react";
import SpreadsheetCalculator from "@/components/SpreadsheetCalculator";
import QuickActions from "@/components/QuickActions";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
              <Cloud className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                GCP Pricing Calculator
              </h1>
              <p className="text-sm text-muted-foreground">
                Excel-like interface for Compute Engine cost analysis
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="flex-shrink-0">
            <QuickActions />
          </aside>

          {/* Main Calculator */}
          <div className="flex-1 min-w-0">
            <SpreadsheetCalculator />
          </div>
        </div>
      </main>
    </div>
  );
}
