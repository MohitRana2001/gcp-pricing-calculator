"use client";

import Image from "next/image";
import SpreadsheetCalculator from "@/components/SpreadsheetCalculator";
import QuickActions from "@/components/QuickActions";
import { useVmStore } from "@/store/vmStore";
import { Server, HardDrive, Database, Sparkles } from "lucide-react";

export default function Home() {
  const { selectedService } = useVmStore();

  const renderMainContent = () => {
    if (!selectedService) {
      // Landing state - no service selected
      return (
        <div className="flex flex-col items-center justify-center min-h-[600px] text-center">
          <div className="mb-8">
            <Sparkles className="h-16 w-16 text-primary mx-auto mb-4 opacity-50" />
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to GCP Cost Calculator
            </h2>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              Select a service from the sidebar to start estimating costs for
              your Google Cloud Platform resources.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
            <div className="p-6 border-2 border-dashed border-gray-200 rounded-lg">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 w-fit mx-auto mb-4">
                <Server className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Compute Engine</h3>
              <p className="text-sm text-gray-600">
                Calculate costs for virtual machines, custom instances, and
                computing resources.
              </p>
            </div>

            <div className="p-6 border-2 border-dashed border-gray-200 rounded-lg opacity-60">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 w-fit mx-auto mb-4">
                <HardDrive className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Cloud Storage</h3>
              <p className="text-sm text-gray-600">
                Estimate costs for object storage, data transfer, and
                operations.
              </p>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
                Coming Soon
              </span>
            </div>

            <div className="p-6 border-2 border-dashed border-gray-200 rounded-lg opacity-60">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 w-fit mx-auto mb-4">
                <Database className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Cloud SQL</h3>
              <p className="text-sm text-gray-600">
                Calculate costs for managed databases, storage, and backup.
              </p>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Service selected - show appropriate calculator
    switch (selectedService) {
      case "compute-engine":
        return <SpreadsheetCalculator />;
      case "cloud-storage":
        return (
          <div className="flex flex-col items-center justify-center min-h-[600px] text-center">
            <div className="p-6 bg-green-50 rounded-full mb-6">
              <HardDrive className="h-16 w-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Cloud Storage Calculator
            </h2>
            <p className="text-gray-600 mb-4">
              Cloud Storage cost calculator is coming soon!
            </p>
            <div className="text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
              This feature will include storage classes, data transfer, and
              operations pricing.
            </div>
          </div>
        );
      case "cloud-sql":
        return (
          <div className="flex flex-col items-center justify-center min-h-[600px] text-center">
            <div className="p-6 bg-purple-50 rounded-full mb-6">
              <Database className="h-16 w-16 text-purple-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Cloud SQL Calculator
            </h2>
            <p className="text-gray-600 mb-4">
              Cloud SQL cost calculator is coming soon!
            </p>
            <div className="text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
              This feature will include database instances, storage, and backup
              pricing.
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg p-2 flex items-center justify-center">
                <Image
                  src="/images/icons8-google-cloud.svg"
                  alt="Google Cloud Platform"
                  width={56}
                  height={56}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  GCP Cost Calculator
                </h1>
                <p className="text-sm text-gray-600">
                  Professional cost estimation for Google Cloud Platform
                  services
                </p>
              </div>
            </div>

            {selectedService && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Active Service:</span>
                <span className="font-semibold text-primary capitalize">
                  {selectedService.replace("-", " ")}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="flex-shrink-0">
            <QuickActions />
          </aside>

          {/* Main Calculator Area */}
          <div className="flex-1 min-w-0">{renderMainContent()}</div>
        </div>
      </main>
    </div>
  );
}
