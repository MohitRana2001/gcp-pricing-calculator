import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { configurations } = body;
    
    // We'll use the first configuration from the spreadsheet row
    const config = configurations[0];
    console.log(config);
    
    // IMPORTANT: Construct the full path to your Python script
    const scriptPath = path.join(process.cwd(), 'python_scripts', 'generate_link.py');

    // Use a Promise to handle the asynchronous Python script execution
    const runPythonScript = new Promise<string>((resolve, reject) => {
      const pythonProcess = spawn('python3', [
        scriptPath,
        JSON.stringify(config),
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