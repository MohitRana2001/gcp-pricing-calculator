#!/bin/bash

# VM Setup Script for GCP Calculator Automation
# This script installs all necessary dependencies for running Playwright in VM environments

echo "🚀 Setting up VM for GCP Calculator Automation"
echo "=============================================="

# Function to check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        echo "❌ Please don't run this script as root. Run as a regular user with sudo access."
        exit 1
    fi
}

# Function to update system packages
update_system() {
    echo "📦 Updating system packages..."
    sudo apt-get update -y
    sudo apt-get upgrade -y
}

# Function to install Node.js
install_nodejs() {
    echo "📦 Installing Node.js..."
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        echo "✅ Node.js is already installed: $(node --version)"
        return
    fi
    
    # Install Node.js 20 LTS
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    echo "✅ Node.js installed: $(node --version)"
    echo "✅ npm installed: $(npm --version)"
}

# Function to install system dependencies for Playwright
install_playwright_deps() {
    echo "📦 Installing Playwright system dependencies..."
    
    # Essential libraries for headless browser operation
    sudo apt-get install -y \
        libnss3 \
        libatk-bridge2.0-0 \
        libdrm2 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libgbm1 \
        libxss1 \
        libgconf-2-4 \
        libxkbcommon0 \
        libgtk-3-0 \
        libgdk-pixbuf2.0-0 \
        libasound2 \
        libdbus-glib-1-2 \
        libxtst6 \
        libatspi2.0-0 \
        libx11-xcb1 \
        libxcb-dri3-0 \
        libxcb1 \
        libxcb-shm0 \
        libxcb-glx0 \
        libxcb-render0 \
        libxcb-randr0 \
        libxcb-image0 \
        libxcb-keysyms1 \
        libxcb-xtest0 \
        libxcb-icccm4 \
        libxcb-util1 \
        libxcb-cursor0
    
    # Additional dependencies for font rendering
    sudo apt-get install -y \
        fonts-liberation \
        fonts-noto \
        fonts-noto-color-emoji \
        ttf-dejavu-core \
        fontconfig
    
    # Virtual framebuffer for headless environments
    sudo apt-get install -y xvfb
    
    echo "✅ Playwright system dependencies installed"
}

# Function to install project dependencies
install_project_deps() {
    echo "📦 Installing project dependencies..."
    
    if [ ! -f "package.json" ]; then
        echo "❌ package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    npm ci
    
    echo "✅ Project dependencies installed"
}

# Function to setup Playwright browsers
setup_playwright() {
    echo "🎭 Setting up Playwright browsers..."
    
    # Install Playwright system dependencies first
    npx playwright install-deps
    
    # Install only Chromium to save space
    npx playwright install chromium
    
    echo "✅ Playwright browsers installed"
}

# Function to configure environment
configure_environment() {
    echo "🌍 Configuring environment..."
    
    # Create environment file for production
    cat > .env.production << EOL
# Playwright Configuration for VM
PLAYWRIGHT_BROWSERS_PATH=/home/$(whoami)/.cache/ms-playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
NODE_ENV=production

# VM Optimizations
DISABLE_WEB_SECURITY=true
NO_SANDBOX=true
EOL
    
    # Add to bashrc for persistent environment
    cat >> ~/.bashrc << EOL

# GCP Calculator Automation Environment
export PLAYWRIGHT_BROWSERS_PATH=/home/$(whoami)/.cache/ms-playwright
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
EOL
    
    source ~/.bashrc
    
    echo "✅ Environment configured"
}

# Function to test installation
test_installation() {
    echo "🧪 Testing installation..."
    
    # Test Node.js
    echo "Testing Node.js..."
    node --version || { echo "❌ Node.js test failed"; exit 1; }
    
    # Test npm
    echo "Testing npm..."
    npm --version || { echo "❌ npm test failed"; exit 1; }
    
    # Test Playwright
    echo "Testing Playwright..."
    npx playwright --version || { echo "❌ Playwright test failed"; exit 1; }
    
    # Run the troubleshooting script
    echo "Running troubleshooting script..."
    node scripts/vm-troubleshoot.js
    
    echo "✅ Installation test completed"
}

# Function to setup PM2 for production
setup_pm2() {
    echo "⚙️ Setting up PM2 for production..."
    
    # Install PM2 globally
    sudo npm install -g pm2
    
    # Setup PM2 startup
    pm2 startup | grep -E '^sudo.*pm2' | bash
    
    echo "✅ PM2 setup completed"
}

# Function to optimize system for browser automation
optimize_system() {
    echo "🔧 Optimizing system for browser automation..."
    
    # Increase limits for file descriptors
    echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
    echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
    
    # Increase shared memory size for browsers
    echo "tmpfs /dev/shm tmpfs defaults,size=2g 0 0" | sudo tee -a /etc/fstab
    
    # Configure kernel parameters for better performance
    cat >> /etc/sysctl.conf << EOL
# Optimizations for browser automation
vm.max_map_count=262144
kernel.pid_max=4194304
EOL
    
    sudo sysctl -p
    
    echo "✅ System optimizations applied"
}

# Function to create startup script
create_startup_script() {
    echo "📜 Creating startup script..."
    
    cat > start-app.sh << 'EOL'
#!/bin/bash
# GCP Calculator Automation Startup Script

# Set environment variables
export NODE_ENV=production
export PLAYWRIGHT_BROWSERS_PATH=/home/$(whoami)/.cache/ms-playwright

# Start the application
echo "🚀 Starting GCP Calculator Automation..."
npm run build
pm2 start ecosystem.config.js --env production

echo "✅ Application started successfully!"
echo "📊 Use 'pm2 logs' to view logs"
echo "📊 Use 'pm2 status' to check status"
EOL
    
    chmod +x start-app.sh
    
    echo "✅ Startup script created: ./start-app.sh"
}

# Main installation function
main() {
    echo "Starting VM setup..."
    
    check_root
    update_system
    install_nodejs
    install_playwright_deps
    install_project_deps
    setup_playwright
    configure_environment
    setup_pm2
    optimize_system
    create_startup_script
    test_installation
    
    echo ""
    echo "🎉 VM Setup Complete!"
    echo "===================="
    echo ""
    echo "✅ All dependencies installed successfully"
    echo "✅ Environment configured"
    echo "✅ System optimized for browser automation"
    echo ""
    echo "🚀 To start the application:"
    echo "   ./start-app.sh"
    echo ""
    echo "🔧 To troubleshoot issues:"
    echo "   node scripts/vm-troubleshoot.js"
    echo ""
    echo "📊 To monitor the application:"
    echo "   pm2 logs"
    echo "   pm2 status"
    echo ""
    echo "🔄 To restart the application:"
    echo "   pm2 restart gcp-calculator"
    echo ""
}

# Run main function
main "$@"
