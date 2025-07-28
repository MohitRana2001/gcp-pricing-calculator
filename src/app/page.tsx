"use client";

import React from "react";
import Image from "next/image";
import SpreadsheetCalculator from "@/components/SpreadsheetCalculator";
import QuickActions from "@/components/QuickActions";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-lg p-2">
              <Image
                src="/images/icons8-google-cloud.svg"
                alt="Google Cloud Platform"
                width={56}
                height={56}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                GCP Pricing Calculator
              </h1>
              <p className="text-sm text-muted-foreground">
                Professional spreadsheet interface for Google Cloud Compute
                Engine cost analysis
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
