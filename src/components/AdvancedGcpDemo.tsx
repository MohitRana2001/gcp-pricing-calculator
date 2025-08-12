'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  generateGcpCalculatorUrl, 
  generateGcpCalculatorUrlDebug, 
  testAutomation,
  generateIndividualUrls,
  checkServiceHealth,
  getMockVmConfigs
} from '@/lib/gcpUrlGenerator';
import { VmConfig } from '@/lib/calculator';

export default function AdvancedGcpDemo() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const mockConfigs = getMockVmConfigs();

  const handleGenerateUrl = async (debug: boolean = false) => {
    setLoading(true);
    setError('');
    setResult('');

    try {
      console.log('🚀 Starting GCP Calculator URL generation...');
      
      const url = debug 
        ? await generateGcpCalculatorUrlDebug(mockConfigs, true)
        : await generateGcpCalculatorUrl(mockConfigs, { 
            headless: true, 
            timeout: 60000, 
            wantCsvLink: true 
          });
      
      setResult(url);
      console.log('✅ Success! URL generated:', url);
      
      // Open the URL in a new tab
      window.open(url, '_blank');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('❌ Failed to generate URL:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTestAutomation = async () => {
    setLoading(true);
    setError('');
    setResult('');

    try {
      console.log('🧪 Testing automation...');
      await testAutomation();
      setResult('Test completed successfully! Check the console for details.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('❌ Test failed:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateIndividual = async () => {
    setLoading(true);
    setError('');
    setResult('');

    try {
      console.log('🔗 Generating individual URLs...');
      const results = await generateIndividualUrls(mockConfigs.slice(0, 2)); // Limit to 2 for demo
      
      const successCount = results.filter(r => !r.error).length;
      const summary = `Generated ${successCount}/${results.length} URLs successfully`;
      
      setResult(summary);
      console.log('✅ Individual URLs generated:', results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('❌ Failed to generate individual URLs:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckHealth = async () => {
    setLoading(true);
    setError('');
    setResult('');

    try {
      console.log('🔍 Checking service health...');
      const isHealthy = await checkServiceHealth();
      setResult(isHealthy ? 'Service is healthy ✅' : 'Service is not responding ❌');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🎭</span>
          Advanced GCP Calculator Automation Demo
        </CardTitle>
        <p className="text-sm text-gray-600">
          Test the advanced Playwright-based automation for generating GCP Calculator URLs
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Mock Configuration Display */}
        <div>
          <h3 className="text-lg font-medium mb-3">Test Configuration</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Machine Type:</span>
                <br />
                {mockConfigs[0]?.name}
              </div>
              <div>
                <span className="font-medium">Series:</span>
                <br />
                {mockConfigs[0]?.series?.toUpperCase()}
              </div>
              <div>
                <span className="font-medium">Region:</span>
                <br />
                {mockConfigs[0]?.regionLocation}
              </div>
              <div>
                <span className="font-medium">Quantity:</span>
                <br />
                {mockConfigs[0]?.quantity} instance{mockConfigs[0]?.quantity !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button 
            onClick={() => handleGenerateUrl(false)}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Generating...' : 'Generate URL (Headless)'}
          </Button>
          
          <Button 
            onClick={() => handleGenerateUrl(true)}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? 'Generating...' : 'Debug Mode (Visible)'}
          </Button>
          
          <Button 
            onClick={handleGenerateIndividual}
            disabled={loading}
            variant="secondary"
            className="w-full"
          >
            {loading ? 'Generating...' : 'Individual URLs'}
          </Button>
          
          <Button 
            onClick={handleCheckHealth}
            disabled={loading}
            variant="ghost"
            className="w-full"
          >
            {loading ? 'Checking...' : 'Check Health'}
          </Button>
        </div>

        {/* Test Automation Button */}
        <div className="border-t pt-4">
          <Button 
            onClick={handleTestAutomation}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? 'Testing...' : '🧪 Run Full Automation Test'}
          </Button>
        </div>

        {/* Results Display */}
        {result && (
          <Alert className="bg-green-50 border-green-200">
            <div className="flex items-start gap-2">
              <Badge className="bg-green-100 text-green-800">Success</Badge>
              <div className="flex-1">
                <p className="text-sm">{result}</p>
                {result.startsWith('https://') && (
                  <a 
                    href={result} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm break-all"
                  >
                    {result}
                  </a>
                )}
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

        {/* Feature Information */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">🚀 New Features</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Advanced Playwright automation with robust error handling</li>
            <li>• Screenshot capture for debugging (stored in /artifacts)</li>
            <li>• Support for multiple configurations in a single URL</li>
            <li>• Comprehensive validation and error reporting</li>
            <li>• CSV download link extraction</li>
            <li>• Debug mode with visible browser for troubleshooting</li>
          </ul>
        </div>

        {/* Important Notes */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-medium text-yellow-900 mb-2">⚠️ Important Notes</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• Debug mode opens a visible browser window</li>
            <li>• Automation may take 30-60 seconds to complete</li>
            <li>• Screenshots and logs are saved to /artifacts directory</li>
            <li>• Check browser console for detailed logs</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
