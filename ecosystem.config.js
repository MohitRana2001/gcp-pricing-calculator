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
      },
    },
  ],
};