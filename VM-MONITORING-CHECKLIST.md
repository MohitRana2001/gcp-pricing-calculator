# VM Monitoring Checklist

## 🚨 Critical Issues to Watch For

### **1. Browser Launch Failures**

**Symptoms:**

- Error: "Failed to launch browser"
- 500 errors on API calls
- "Browser closed unexpectedly"

**Debug Steps:**

```bash
# Check if browser dependencies are installed
npm run troubleshoot:vm

# Manual browser test
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log('✅ Browser launched successfully');
  await browser.close();
})().catch(console.error);
"
```

**Solutions:**

```bash
# Install missing dependencies
sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libgconf-2-4

# Install fonts
sudo apt-get install -y fonts-liberation fonts-noto fonts-noto-color-emoji
```

### **2. Memory Issues**

**Symptoms:**

- Application crashes during link generation
- "Out of memory" errors
- Slow response times

**Monitor:**

```bash
# Check memory usage
free -h
watch -n 1 'free -h && echo "---" && ps aux --sort=-%mem | head -10'

# Check swap usage
swapon --show
```

**Solutions:**

```bash
# Add swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### **3. Network/Timeout Issues**

**Symptoms:**

- Timeouts when generating links
- "Network connectivity issue" errors
- DNS resolution failures

**Debug:**

```bash
# Test DNS resolution
nslookup cloud.google.com

# Test network connectivity
curl -I https://cloud.google.com/products/calculator

# Check firewall
sudo ufw status
```

### **4. Permission Issues**

**Symptoms:**

- Browser won't start
- File permission errors
- Can't write to directories

**Solutions:**

```bash
# Fix file permissions
chmod +x scripts/vm-setup.sh
chmod +x start-app.sh

# Ensure user has proper permissions
sudo chown -R $USER:$USER /home/$USER/.cache/ms-playwright
```

## ✅ Success Indicators

### **Application Startup:**

- ✅ Server starts on port 3000
- ✅ No error messages in startup logs
- ✅ Health check endpoint responds
- ✅ Browser automation test passes

### **Link Generation:**

- ✅ Individual links generate in < 60 seconds
- ✅ Parallel generation works for all 3 types
- ✅ Debug mode provides detailed logs
- ✅ Generated links are valid GCP calculator URLs

### **System Performance:**

- ✅ Memory usage < 80% of available
- ✅ CPU usage reasonable during generation
- ✅ No frequent crashes or restarts
- ✅ Response times consistent

## 📊 Performance Benchmarks

### **Expected Response Times:**

- Single link generation: 30-60 seconds
- Parallel link generation: 45-90 seconds
- Simple API calls: < 5 seconds

### **Resource Usage:**

- Memory: 500MB-1GB during generation
- CPU: High during automation, low at rest
- Disk: < 100MB additional storage

## 🔧 Quick Fixes

### **If Links Fail to Generate:**

1. Run troubleshooting script: `npm run troubleshoot:vm`
2. Check browser dependencies
3. Verify network connectivity
4. Try debug mode for detailed errors

### **If Application Won't Start:**

1. Check port 3000 availability: `lsof -i :3000`
2. Verify Node.js version: `node --version`
3. Reinstall dependencies: `npm ci`
4. Check file permissions

### **If Performance is Poor:**

1. Monitor system resources: `htop`
2. Check available memory: `free -h`
3. Increase timeout values in options
4. Consider adding more VM resources

## 📞 Emergency Commands

```bash
# Restart application
pm2 restart gcp-calculator

# View detailed logs
pm2 logs gcp-calculator --lines 100

# System resource check
htop
df -h
free -h

# Quick health test
npm run troubleshoot:vm

# Reset browser cache
rm -rf /home/$USER/.cache/ms-playwright
npx playwright install chromium
```
