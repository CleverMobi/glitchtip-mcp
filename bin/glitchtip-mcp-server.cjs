#!/usr/bin/env node

// CommonJS wrapper for better npx compatibility
const { spawn } = require('child_process');
const path = require('path');

// Path to the actual implementation
const indexPath = path.join(__dirname, '..', 'src', 'index.js');

// Spawn node with the index.js file
const child = spawn(process.execPath, [indexPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});