module.exports = {
  apps: [
    {
      name: 'advanced-issue',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
