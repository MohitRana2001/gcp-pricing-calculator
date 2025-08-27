const { execSync } = require('child_process');

// Test data
const testRequest = {
  service: 'Compute Engine',
  timeoutMs: 60000,
  wantCsvLink: false,
  instances: [
    {
      numberOfInstances: 1,
      totalHours: 730,
      operatingSystem: 'linux',
      provisioningModel: 'regular',
      series: 'e2',
      machineType: 'e2-standard-2',
      region: 'us-central1',
      committedUse: 'none',
      isCustom: false
    }
  ]
};

async function testLocalFunction() {
  console.log('🧪 Testing Cloud Function locally...');
  
  try {
    // Start the functions framework in background
    console.log('🚀 Starting Functions Framework...');
    const child = execSync('npm start &', { stdio: 'inherit' });
    
    // Wait for function to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📤 Sending test request...');
    
    // Make test request
    const response = await fetch('http://localhost:8080', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testRequest)
    });
    
    const result = await response.json();
    
    console.log('📥 Response received:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Test passed!');
      console.log(`🔗 Generated URL: ${result.shareUrl}`);
    } else {
      console.log('❌ Test failed!');
      console.log(`Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
  
  // Kill background process
  try {
    execSync('pkill -f "functions-framework"');
  } catch (e) {
    // Ignore cleanup errors
  }
}

// Run test if called directly
if (require.main === module) {
  testLocalFunction();
}

module.exports = { testLocalFunction };
