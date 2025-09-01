# Environment Variables Configuration

This document describes the environment variables needed for the GCP Pricing Calculator application.

## Required Environment Variables

### Google Cloud Project

- `GOOGLE_CLOUD_PROJECT`: Your Google Cloud Project ID

### GCP Calculator API Credentials

The Python scripts require these credentials to interact with the GCP Calculator API:

- `AT_TOKEN`: Authentication token for GCP Calculator API
- `F_SID`: Session ID for GCP Calculator API
- `BL_VERSION`: Build version for GCP Calculator API

### Application Configuration

- `NODE_ENV`: Set to `production` for production deployment
- `PORT`: Port number (default: 8080 for Cloud Run)

## How to Obtain GCP Calculator API Credentials

1. Open [GCP Pricing Calculator](https://cloud.google.com/calculator) in your browser
2. Open browser Developer Tools (F12)
3. Go to the Network tab
4. Configure any instance in the calculator
5. Look for requests to `batchexecute` endpoint
6. Extract the following from the request:
   - `at` parameter → `AT_TOKEN`
   - `f.sid` parameter → `F_SID`
   - `bl` parameter → `BL_VERSION`

## Setting Environment Variables in Cloud Run

### Method 1: Using gcloud CLI

```bash
gcloud run services update gcp-pricing-calculator \
  --region=us-central1 \
  --set-env-vars="AT_TOKEN=your_token,F_SID=your_sid,BL_VERSION=your_version"
```

### Method 2: Using Google Cloud Console

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Select your service
3. Click "Edit & Deploy New Revision"
4. Go to "Variables & Secrets" tab
5. Add environment variables
6. Deploy the new revision

### Method 3: During deployment with deploy.sh

The deployment script will prompt for setting environment variables after deployment.

## Local Development

For local development, create a `.env.local` file in the project root:

```env
# .env.local
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
AT_TOKEN=your_authentication_token_here
F_SID=your_session_id_here
BL_VERSION=your_build_version_here
NODE_ENV=development
PORT=3000
```

**Note**: Never commit `.env.local` or any file containing actual credentials to version control.

## Security Considerations

- Keep API credentials secure and rotate them regularly
- Use Google Cloud Secret Manager for sensitive data in production
- Never expose credentials in client-side code
- Use least-privilege access principles for service accounts

## Troubleshooting

If you encounter authentication errors:

1. Verify all three credentials are set correctly
2. Check if credentials have expired (they may need periodic refresh)
3. Ensure the credentials are from the same browser session
4. Try obtaining fresh credentials from the calculator
