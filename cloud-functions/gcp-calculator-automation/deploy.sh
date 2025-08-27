#!/bin/bash

# Google Cloud Function Deployment Script
# This script deploys the GCP Calculator automation as a Cloud Function

echo "🚀 Deploying GCP Calculator Automation Cloud Function"
echo "===================================================="

# Function configuration
FUNCTION_NAME="gcp-calculator-automation"
REGION="us-central1"  # Change this to your preferred region
RUNTIME="nodejs20"
MEMORY="2GB"
TIMEOUT="540s"  # 9 minutes (maximum for Cloud Functions)
MAX_INSTANCES="10"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed or not in PATH"
    echo "💡 Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
echo "🔐 Checking authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud"
    echo "💡 Run: gcloud auth login"
    exit 1
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project set"
    echo "💡 Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "✅ Authenticated and using project: $PROJECT_ID"

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable eventarc.googleapis.com

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Deploy function with authentication required (more secure)
echo "🚀 Deploying function with authentication..."
gcloud functions deploy $FUNCTION_NAME \
    --gen2 \
    --runtime=$RUNTIME \
    --region=$REGION \
    --source=. \
    --entry-point=gcpCalculatorAutomation \
    --trigger=http \
    --memory=$MEMORY \
    --timeout=$TIMEOUT \
    --max-instances=$MAX_INSTANCES \
    --set-env-vars="NODE_ENV=production" \
    --quiet

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    
    # Get function URL
    FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME --region=$REGION --format="value(serviceConfig.uri)")
    
    echo "📋 Function Details:"
    echo "  Name: $FUNCTION_NAME"
    echo "  Region: $REGION"
    echo "  URL: $FUNCTION_URL"
    echo "  Memory: $MEMORY"
    echo "  Timeout: $TIMEOUT"
    echo ""
    
    echo "🔐 Authentication Required:"
    echo "  This function requires authentication for security."
    echo "  To call it, you need to include an authorization header."
    echo ""
    
    echo "🧪 Test the function:"
    echo "  # Get access token"
    echo "  TOKEN=\$(gcloud auth print-access-token)"
    echo ""
    echo "  # Make authenticated request"
    echo "  curl -X POST $FUNCTION_URL \\"
    echo "    -H \"Authorization: Bearer \$TOKEN\" \\"
    echo "    -H \"Content-Type: application/json\" \\"
    echo "    -d '{
        \"service\": \"Compute Engine\",
        \"instances\": [
          {
            \"numberOfInstances\": 1,
            \"totalHours\": 730,
            \"operatingSystem\": \"linux\",
            \"provisioningModel\": \"regular\",
            \"series\": \"e2\",
            \"machineType\": \"e2-standard-2\",
            \"region\": \"us-central1\",
            \"committedUse\": \"none\",
            \"isCustom\": false
          }
        ]
      }'"
    echo ""
    
    echo "📝 Next Steps:"
    echo "1. Update your main application to call this Cloud Function"
    echo "2. Set up service account authentication for your main app"
    echo "3. Test the integration"
    echo ""
    
    echo "⚠️ Security Note:"
    echo "  The function is deployed with authentication required."
    echo "  Your main application will need proper credentials to call it."
    
else
    echo "❌ Deployment failed!"
    exit 1
fi
