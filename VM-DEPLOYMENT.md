# VM Deployment Guide for GCP Calculator Automation

This guide provides comprehensive instructions for deploying the GCP Calculator Automation project in VM environments, including troubleshooting common issues.

## Quick Start

### 1. Automated Setup (Recommended)

Run the automated setup script that installs all dependencies:

```bash
# Clone the repository (if not already done)
git clone <your-repo-url>
cd pc

# Run the automated VM setup script
npm run setup:vm
```

This script will:

- Install Node.js 20 LTS
- Install all Playwright system dependencies
- Install project dependencies
- Configure environment variables
- Optimize system settings
- Set up PM2 for production
- Test the installation

### 2. Manual Setup

If you prefer manual setup or the automated script fails:

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Playwright dependencies
sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 \
  libxdamage1 libxrandr2 libgbm1 libxss1 libgconf-2-4 libxkbcommon0 \
  libgtk-3-0 libgdk-pixbuf2.0-0 libasound2 fonts-liberation fonts-noto \
  fonts-noto-color-emoji xvfb

# Install project dependencies
npm ci

# Setup Playwright
npx playwright install-deps
npx playwright install chromium

# Build the project
npm run build
```

## Troubleshooting

### 1. Run Diagnostic Script

First, run the built-in troubleshooting script:

```bash
npm run troubleshoot:vm
```

This will generate a diagnostic report and test all components.

### 2. Common Issues and Solutions

#### Browser Launch Failures

**Issue**: `Error: Failed to launch browser`

**Solutions**:

```bash
# Install missing dependencies
sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libgconf-2-4

# Install fonts
sudo apt-get install -y fonts-liberation fonts-noto fonts-noto-color-emoji

# For containers or low-privilege environments
export CHROME_BIN=/usr/bin/chromium-browser
```

#### Memory Issues

**Issue**: Browser crashes or "out of memory" errors

**Solutions**:

```bash
# Increase VM memory (recommended: 2GB+)
# Add swap space if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Optimize Node.js memory usage
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### Network/Timeout Issues

**Issue**: Network timeouts or connection errors

**Solutions**:

```bash
# Check DNS resolution
nslookup cloud.google.com

# Increase timeouts in production
export PLAYWRIGHT_TIMEOUT=120000

# Check firewall settings
sudo ufw status
```

#### Permission Issues

**Issue**: Browser fails to start due to permissions

**Solutions**:

```bash
# Don't run as root - create a non-root user
sudo useradd -m -s /bin/bash playwright
sudo usermod -aG sudo playwright

# If you must run as root (not recommended)
export CHROME_ARGS="--no-sandbox --disable-setuid-sandbox"
```

### 3. Environment Variables

Set these environment variables for optimal performance:

```bash
# Add to ~/.bashrc or .env file
export NODE_ENV=production
export PLAYWRIGHT_BROWSERS_PATH=/home/$(whoami)/.cache/ms-playwright
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
export NODE_OPTIONS="--max-old-space-size=4096"

# VM-specific optimizations
export DISABLE_WEB_SECURITY=true
export NO_SANDBOX=true
```

### 4. System Optimizations

Apply these system-level optimizations:

```bash
# Increase file descriptor limits
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Increase shared memory for browsers
echo "tmpfs /dev/shm tmpfs defaults,size=2g 0 0" | sudo tee -a /etc/fstab

# Kernel optimizations
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
echo "kernel.pid_max=4194304" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
sudo npm install -g pm2

# Start the application
pm2 start ecosystem.config.js --env production

# Setup auto-restart on system reboot
pm2 startup
pm2 save

# Monitor the application
pm2 logs
pm2 status
```

### Using Docker

For containerized deployment, use the provided Dockerfile:

```bash
# Build the image
docker build -t gcp-calculator .

# Run the container
docker run -d \
  --name gcp-calculator \
  --memory="2g" \
  --shm-size="1g" \
  -p 3000:3000 \
  gcp-calculator
```

## Features

### Parallel Link Generation

The application now supports generating all three commitment type links in parallel:

1. **Parallel Generation Button** (Blue icon): Generates all links simultaneously
2. **Debug Mode Button** (Orange icon): Generates all links with debug information
3. **Individual Generation**: Click individual "Generate" buttons for specific commitment types

### Enhanced Error Handling

- Comprehensive VM-specific error messages
- Automatic retry mechanisms
- Detailed logging and diagnostics
- Memory usage optimization

### Debug Mode

Enable debug mode for detailed troubleshooting:

```javascript
// In the UI, use the orange debug button, or
fetch("/api/generate-gcp-url", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    configurations: [config],
    commitment: "none",
    options: {
      debug: true,
      timeout: 120000,
    },
  }),
});
```

## Monitoring and Maintenance

### Health Checks

```bash
# Check application health
curl http://localhost:3000/health

# Check Playwright functionality
npm run troubleshoot:vm

# Monitor system resources
htop
df -h
free -h
```

### Log Management

```bash
# View application logs
pm2 logs gcp-calculator

# View system logs
sudo journalctl -u gcp-calculator -f

# Clear old logs
pm2 flush
```

### Updates

```bash
# Update the application
git pull origin main
npm ci
npm run build
pm2 restart gcp-calculator
```

## Performance Tuning

### For High-Volume Usage

1. **Increase VM Resources**:

   - RAM: 4GB+ recommended
   - CPU: 2+ cores
   - Storage: SSD preferred

2. **Browser Pool Configuration**:

   ```javascript
   // Consider implementing browser pooling for high concurrency
   const browserPool = new BrowserPool({ maxBrowsers: 3 });
   ```

3. **Request Rate Limiting**:
   ```javascript
   // Implement rate limiting to avoid overwhelming GCP Calculator
   const rateLimit = 2; // requests per second
   ```

### For Resource-Constrained Environments

1. **Memory Optimization**:

   ```bash
   export NODE_OPTIONS="--max-old-space-size=1024"
   ```

2. **Disable Unnecessary Features**:
   ```javascript
   // Disable artifacts collection in production
   collectArtifacts: false;
   ```

## Support

If you continue to experience issues:

1. Run the diagnostic script: `npm run troubleshoot:vm`
2. Check the generated diagnostic report
3. Review the application logs
4. Ensure VM meets minimum requirements (2GB RAM, 2 CPU cores)
5. Verify network connectivity to `cloud.google.com`

## Minimum System Requirements

- **OS**: Ubuntu 20.04+ or compatible Linux distribution
- **RAM**: 2GB minimum, 4GB recommended
- **CPU**: 1 core minimum, 2+ cores recommended
- **Storage**: 5GB free space
- **Network**: Stable internet connection with HTTPS access
- **Node.js**: Version 20 LTS
