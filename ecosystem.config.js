module.exports = {
  apps: [
    {
      name: 'gcp-calculator',
      script: 'npm',
      args: 'start',
      // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_URL: 'http://35.244.40.255:3000',
        GOOGLE_CLOUD_PROJECT: "ps-apprentice",
        AT_TOKEN: "AKD5WVCdgnELjWkK0BAR6Er__9j9:1756685274075",
        F_SID: "8408856231150799963",
        BL_VERSION: "boq_cloud-ux-webapp-cgc-ui_20250829.03_p0"
      },
    },
  ],
};