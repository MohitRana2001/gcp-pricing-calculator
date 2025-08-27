# GCP Calculator Automation Cloud Function

This directory contains a Google Cloud Function that handles the Playwright browser automation for GCP Calculator link generation. By running the automation in Cloud Functions instead of on your VM, you get better reliability, scalability, and resource management.

## 🌟 Benefits of Cloud Function Approach

### **Reliability**

- ✅ No browser dependency issues on your VM
- ✅ Consistent execution environment
- ✅ Automatic retries and error handling
- ✅ No memory leaks or resource exhaustion

### **Scalability**

- ✅ Automatic scaling based on demand
- ✅ Parallel execution for multiple requests
- ✅ No VM resource limitations
- ✅ Pay-per-use pricing model

### **Maintenance**

- ✅ No browser maintenance on your VM
- ✅ Automatic updates and patches
- ✅ Centralized automation logic
- ✅ Easy deployment and rollbacks

## 📁 Directory Structure

```
cloud-functions/gcp-calculator-automation/
├── index.js           # Main Cloud Function code
├── package.json       # Dependencies and scripts
├── deploy.sh          # Deployment script
├── test-local.js      # Local testing utility
└── README.md          # This file
```

## 🚀 Quick Start

### **1. Prerequisites**

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

# Authenticate with Google Cloud
gcloud auth login

# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### **2. Deploy the Cloud Function**

```bash
cd cloud-functions/gcp-calculator-automation

# Install dependencies
npm install

# Deploy to Google Cloud
chmod +x deploy.sh
./deploy.sh
```

### **3. Update Your Main Application**

Set the environment variable in your main application:

```bash
# In your main application's .env file
GCP_CALCULATOR_FUNCTION_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/gcp-calculator-automation
```

### **4. Test the Integration**

Your main application will now use the Cloud Function automatically. Test by:

1. Starting your main application
2. Creating a VM configuration
3. Clicking "Generate" buttons
4. Verifying links are generated successfully

## 🔧 Configuration

### **Environment Variables**

#### **Main Application (.env)**

```bash
# Required: Cloud Function URL
GCP_CALCULATOR_FUNCTION_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/gcp-calculator-automation

# Optional: Access token for authenticated calls
GCP_ACCESS_TOKEN=your_access_token_here

# Optional: Project ID for automatic token generation
GOOGLE_CLOUD_PROJECT=your_project_id
```

#### **Cloud Function Environment**

The Cloud Function automatically inherits the necessary environment for browser automation.

### **Function Configuration**

Edit `deploy.sh` to customize:

```bash
REGION="us-central1"      # Change region as needed
MEMORY="2GB"              # Adjust memory allocation
TIMEOUT="540s"            # Maximum 9 minutes
MAX_INSTANCES="10"        # Limit concurrent instances
```

## 🧪 Testing

### **Local Testing**

```bash
cd cloud-functions/gcp-calculator-automation

# Install dependencies
npm install

# Test locally
npm test
# OR
node test-local.js
```

### **Production Testing**

```bash
# Get access token
TOKEN=$(gcloud auth print-access-token)

# Test the deployed function
curl -X POST https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/gcp-calculator-automation \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "Compute Engine",
    "instances": [
      {
        "numberOfInstances": 1,
        "totalHours": 730,
        "operatingSystem": "linux",
        "provisioningModel": "regular",
        "series": "e2",
        "machineType": "e2-standard-2",
        "region": "us-central1",
        "committedUse": "none",
        "isCustom": false
      }
    ]
  }'
```

## 🔐 Authentication

### **Option 1: Service Account (Recommended for Production)**

1. **Create Service Account:**

```bash
gcloud iam service-accounts create gcp-calculator-client \
    --display-name="GCP Calculator Client"
```

2. **Grant Permissions:**

```bash
gcloud functions add-iam-policy-binding gcp-calculator-automation \
    --region=us-central1 \
    --member="serviceAccount:gcp-calculator-client@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudfunctions.invoker"
```

3. **Download Key:**

```bash
gcloud iam service-accounts keys create ~/gcp-calculator-key.json \
    --iam-account=gcp-calculator-client@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

4. **Set Environment Variable:**

```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/gcp-calculator-key.json
```

### **Option 2: User Credentials (Development)**

```bash
# Use your personal credentials
gcloud auth application-default login
```

### **Option 3: Access Token**

```bash
# Get temporary token
TOKEN=$(gcloud auth print-access-token)

# Set in your application
export GCP_ACCESS_TOKEN=$TOKEN
```

## 📊 Monitoring

### **Cloud Console**

1. Go to [Cloud Functions Console](https://console.cloud.google.com/functions)
2. Click on your function
3. View logs, metrics, and performance data

### **Command Line**

```bash
# View logs
gcloud functions logs read gcp-calculator-automation --region=us-central1

# Get function details
gcloud functions describe gcp-calculator-automation --region=us-central1
```

### **Main Application Logs**

Monitor your main application logs for:

- ✅ `☁️ Calling Cloud Function for GCP Calculator automation...`
- ✅ `✅ Successfully generated GCP calculator URL`
- ❌ `❌ Error calling Cloud Function`

## 🐛 Troubleshooting

### **Common Issues**

#### **401 Unauthorized**

```
Error: Authentication failed - please check your GCP credentials and permissions.
```

**Solutions:**

1. Verify service account has `cloudfunctions.invoker` role
2. Check `GOOGLE_APPLICATION_CREDENTIALS` path
3. Ensure access token is valid

#### **404 Not Found**

```
Error: Cloud Function not found - please check the function URL and ensure it is deployed.
```

**Solutions:**

1. Verify `GCP_CALCULATOR_FUNCTION_URL` is correct
2. Check function is deployed: `gcloud functions list`
3. Ensure region matches in URL

#### **Timeout Errors**

```
Error: Cloud Function timeout - the automation is taking too long.
```

**Solutions:**

1. Increase timeout in `deploy.sh` (max 540s)
2. Reduce number of configurations per request
3. Check Cloud Function logs for stuck operations

#### **503 Service Unavailable**

```
Error: Cloud Function is temporarily unavailable - please try again in a few moments.
```

**Solutions:**

1. Wait and retry (temporary cold start)
2. Check Cloud Function quota limits
3. Verify function isn't in error state

### **Debug Commands**

```bash
# Check function status
gcloud functions describe gcp-calculator-automation --region=us-central1

# View recent logs
gcloud functions logs read gcp-calculator-automation --region=us-central1 --limit=50

# Test authentication
gcloud auth print-access-token

# Validate deployment
gcloud functions list --filter="name:gcp-calculator-automation"
```

## 💰 Cost Estimation

### **Cloud Function Costs**

- **Invocations:** $0.40 per million requests
- **Compute Time:** $0.0000025 per 100ms at 2GB memory
- **Network:** $0.12 per GB egress

### **Example Monthly Costs**

**Light Usage** (100 links/month):

- ~$0.05/month

**Medium Usage** (1,000 links/month):

- ~$0.50/month

**Heavy Usage** (10,000 links/month):

- ~$5.00/month

_Note: Actual costs may vary based on execution time and network usage._

## 🔄 Updates and Maintenance

### **Updating the Function**

```bash
cd cloud-functions/gcp-calculator-automation

# Make your changes to index.js

# Redeploy
./deploy.sh
```

### **Monitoring Function Health**

```bash
# Add to your monitoring system
curl -X POST https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/gcp-calculator-automation \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"service": "Compute Engine", "instances": []}'
```

### **Rollback if Needed**

```bash
# List versions
gcloud functions versions list --region=us-central1

# Rollback to previous version
gcloud functions deploy gcp-calculator-automation \
    --region=us-central1 \
    --source-version=VERSION_ID
```

## 🎯 Next Steps

1. **Deploy the Cloud Function** using the provided scripts
2. **Update your main application** environment variables
3. **Test the integration** thoroughly
4. **Set up monitoring** and alerts
5. **Consider implementing** request caching for frequently used configurations

This Cloud Function approach should eliminate all the VM-related browser automation issues while providing a more robust and scalable solution!
