import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { Currency } from 'lucide-react';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { configurations, commitment = "none", currency = "USD" } = body;
    
    // We'll use the first configuration from the spreadsheet row
    const config = configurations[0];
    console.log('Configuration received:', config);
    console.log('Commitment type:', commitment);
    console.log('Config commitment field:', config.commitment);
    
    // Enhanced config to ensure all required fields are present
    const enhancedConfig = {
      ...config,
      os: config.os || 'linux',
      provisioningModel: config.provisioningModel || 'regular',
      runningHours: config.runningHours || 730,
      quantity: config.quantity || 1,
      commitment: commitment,
      currency: currency,
    };

    console.log('Enhanced configuration:', enhancedConfig);
    
    // IMPORTANT: Construct the full path to your Python script
    const scriptPath = path.join(process.cwd(), 'python_scripts', 'generate_link.py');

    // Use a Promise to handle the asynchronous Python script execution
    const runPythonScript = new Promise<string>((resolve, reject) => {
      const pythonProcess = spawn('python3', [
        scriptPath,
        JSON.stringify(enhancedConfig),
      ]);

      let shareUrl = '';
      let errorMessage = '';

      pythonProcess.stdout.on('data', (data) => {
        shareUrl += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorMessage += data.toString();
        console.error(`Python Script Error: ${data}`);
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Script failed with code ${code}: ${errorMessage}`));
        } else {
          resolve(shareUrl.trim());
        }
      });
      
      pythonProcess.on('error', (err) => {
        reject(new Error(`Failed to start Python script: ${err.message}`));
      });
    });

    // Await the result from the Python script
    const generatedUrl = await runPythonScript;

    // Send the successful response back to the frontend
    return NextResponse.json({ 
      success: true, 
      shareUrl: generatedUrl 
    });

  } catch (error) {
    console.error('API Route Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { success: false, error: message }, 
      { status: 500 }
    );
  }
}