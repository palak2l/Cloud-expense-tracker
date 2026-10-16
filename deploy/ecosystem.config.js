module.exports = {
  apps: [
    {
      name: "expense-tracker",
      cwd: "/home/ubuntu/cloud-expense-tracker",
      script: "src/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
