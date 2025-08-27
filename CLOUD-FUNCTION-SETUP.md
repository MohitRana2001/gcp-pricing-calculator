# Cloud Function Setup Guide

This guide will help you deploy the GCP Calculator automation as a Cloud Function, eliminating VM browser automation issues.

## 🎯 Why Use Cloud Functions?

**Problems with VM approach:**

- ❌ Browser dependency issues
- ❌ Memory/resource constraints
- ❌ Complex VM setup and maintenance
- ❌ Inconsistent execution environment

**Cloud Function benefits:**

- ✅ No browser setup required on your VM
- ✅ Reliable, consistent execution
- ✅ Automatic scaling and resource management
- ✅ Pay-per-use pricing
- ✅ Zero maintenance overhead

## 🚀 Quick Setup (5 minutes)

### Step 1: Deploy the Cloud Function

```bash
# Navigate to the Cloud Function directory
cd cloud-functions/gcp-calculator-automation

# Install dependencies
npm install

# Deploy to Google Cloud (requires gcloud CLI)
chmod +x deploy.sh
./deploy.sh
```

### Step 2: Configure Your Application

Add this to your `.env` file:

```bash
GCP_CALCULATOR_FUNCTION_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/gcp-calculator-automation
```

### Step 3: Test

Start your application and test link generation - it now uses the Cloud Function automatically!

## 📋 Prerequisites

1. **Google Cloud Project**

   ```bash
   # Create project (if needed)
   gcloud projects create your-project-id
   gcloud config set project your-project-id
   ```

2. **Google Cloud CLI**

   ```bash
   # Install from: https://cloud.google.com/sdk/docs/install
   gcloud auth login
   ```

3. **Enable APIs**
   ```bash
   gcloud services enable cloudfunctions.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

## 🔐 Authentication Setup

### Option A: Service Account (Recommended)

```bash
# Create service account
gcloud iam service-accounts create gcp-calculator-client

# Grant function invoker permission
gcloud functions add-iam-policy-binding gcp-calculator-automation \
    --region=us-central1 \
    --member="serviceAccount:gcp-calculator-client@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudfunctions.invoker"

# Create and download key
gcloud iam service-accounts keys create ~/gcp-calculator-key.json \
    --iam-account=gcp-calculator-client@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS=~/gcp-calculator-key.json
```

### Option B: User Credentials (Development)

```bash
gcloud auth application-default login
```

## 🧪 Testing

### Test the Cloud Function Directly

```bash
# Get access token
TOKEN=$(gcloud auth print-access-token)

# Test function
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

### Test Your Application

1. Start your application: `npm run dev`
2. Create a VM configuration
3. Click "Generate" button
4. Verify the link is generated successfully

## 📊 Monitoring

### View Logs

```bash
gcloud functions logs read gcp-calculator-automation --region=us-central1
```

### Check Status

```bash
gcloud functions describe gcp-calculator-automation --region=us-central1
```

## 🐛 Troubleshooting

### Function Not Found (404)

- Verify function name and region in URL
- Check deployment: `gcloud functions list`

### Authentication Error (401/403)

- Verify service account has `cloudfunctions.invoker` role
- Check `GOOGLE_APPLICATION_CREDENTIALS` path

### Timeout Errors

- Function has 9-minute maximum timeout
- Consider reducing configurations per request

### Function Errors

- Check logs: `gcloud functions logs read gcp-calculator-automation`
- Test with minimal payload first

## 💰 Cost Estimate

**Typical costs for link generation:**

- Light usage (100 links/month): ~$0.05
- Medium usage (1,000 links/month): ~$0.50
- Heavy usage (10,000 links/month): ~$5.00

Much cheaper than running a dedicated VM!

## 🔄 Updates

To update the function:

```bash
cd cloud-functions/gcp-calculator-automation
# Make your changes
./deploy.sh
```

## ✅ Success Checklist

- [ ] Cloud Function deployed successfully
- [ ] Environment variable set in main app
- [ ] Authentication configured
- [ ] Test link generation works
- [ ] No more VM browser issues!

## 🆘 Need Help?

1. Check the [detailed README](cloud-functions/README.md)
2. Review Cloud Function logs
3. Test authentication separately
4. Verify all environment variables are set

This Cloud Function approach should completely eliminate your VM browser automation problems while providing a more reliable and scalable solution!
