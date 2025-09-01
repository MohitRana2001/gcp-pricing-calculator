#!/bin/bash

# Cloud Run Deployment Script for GCP Pricing Calculator
# This script builds and deploys the application to Google Cloud Run

set -e  # Exit on any error

# Configuration variables - modify these as needed
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-gcp-project-id}"
SERVICE_NAME="${SERVICE_NAME:-gcp-pricing-calculator}"
REGION="${REGION:-us-central1}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
PORT=8080

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud CLI is not installed. Please install it first."
        log_info "Visit: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    log_success "All dependencies are installed"
}

# Function to check authentication
check_auth() {
    log_info "Checking Google Cloud authentication..."
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "You are not authenticated with Google Cloud."
        log_info "Please run: gcloud auth login"
        exit 1
    fi
    
    log_success "Google Cloud authentication verified"
}

# Function to set up project
setup_project() {
    log_info "Setting up Google Cloud project..."
    
    if [ "$PROJECT_ID" = "your-gcp-project-id" ]; then
        log_error "Please set your PROJECT_ID in this script or export GOOGLE_CLOUD_PROJECT environment variable"
        exit 1
    fi
    
    # Set the project
    gcloud config set project "$PROJECT_ID"
    
    # Enable required APIs
    log_info "Enabling required APIs..."
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable run.googleapis.com
    gcloud services enable containerregistry.googleapis.com
    
    log_success "Project setup completed"
}

# Function to build and push Docker image
build_and_push() {
    log_info "Building Docker image..."
    
    # Build the image
    docker build -t "$IMAGE_NAME" .
    
    log_info "Pushing image to Google Container Registry..."
    
    # Configure Docker to use gcloud as a credential helper
    gcloud auth configure-docker --quiet
    
    # Push the image
    docker push "$IMAGE_NAME"
    
    log_success "Image built and pushed successfully"
}

# Function to deploy to Cloud Run
deploy_to_cloud_run() {
    log_info "Deploying to Cloud Run..."
    
    # Deploy the service
    gcloud run deploy "$SERVICE_NAME" \
        --image="$IMAGE_NAME" \
        --platform=managed \
        --region="$REGION" \
        --port="$PORT" \
        --allow-unauthenticated \
        --memory=2Gi \
        --cpu=2 \
        --timeout=300 \
        --concurrency=100 \
        --max-instances=10 \
        --min-instances=0
    
    log_success "Deployment completed"
}

# Function to get service URL
get_service_url() {
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
        --platform=managed \
        --region="$REGION" \
        --format="value(status.url)")
    
    log_success "Service deployed successfully!"
    log_info "Service URL: $SERVICE_URL"
    log_info "You can now access your application at the above URL"
}

# Function to display environment variables help
show_env_help() {
    log_info "Environment Variables Configuration:"
    echo "After deployment, you can set environment variables using:"
    echo ""
    echo "gcloud run services update $SERVICE_NAME \\"
    echo "  --region=$REGION \\"
    echo "  --set-env-vars=\"AT_TOKEN=your_at_token,F_SID=your_f_sid,BL_VERSION=your_bl_version\""
    echo ""
    log_warning "Remember to set the following environment variables for your Python scripts:"
    echo "  - AT_TOKEN: Authentication token for GCP Calculator API"
    echo "  - F_SID: Session ID for GCP Calculator API"
    echo "  - BL_VERSION: Build version for GCP Calculator API"
    echo ""
    echo "You can also set them in the Google Cloud Console:"
    echo "https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/revisions"
}

# Main deployment function
main() {
    log_info "Starting Cloud Run deployment process..."
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --project)
                PROJECT_ID="$2"
                shift 2
                ;;
            --service-name)
                SERVICE_NAME="$2"
                shift 2
                ;;
            --region)
                REGION="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --project PROJECT_ID     Google Cloud Project ID"
                echo "  --service-name NAME       Cloud Run service name (default: gcp-pricing-calculator)"
                echo "  --region REGION           Cloud Run region (default: us-central1)"
                echo "  --help                    Show this help message"
                echo ""
                echo "Environment Variables:"
                echo "  GOOGLE_CLOUD_PROJECT      Google Cloud Project ID"
                echo "  SERVICE_NAME              Cloud Run service name"
                echo "  REGION                    Cloud Run region"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                log_info "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Update image name with potentially new project ID
    IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
    
    # Run deployment steps
    check_dependencies
    check_auth
    setup_project
    build_and_push
    deploy_to_cloud_run
    get_service_url
    show_env_help
    
    log_success "Deployment process completed successfully!"
}

# Run the main function
main "$@"
