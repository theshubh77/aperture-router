#!/usr/bin/env node

import { createServer } from './server/app.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

const server = createServer();
const { port, host } = config.server;

server.listen(port, host, () => {
  console.log(`
   ___                      _                  
  / _ \\                    | |                 
 / /_\\ \\_ __   ___ _ __ ___| |_ _   _ _ __ ___ 
 |  _  | '_ \\ / _ \\ '__/ __| __| | | | '__/ _ \\
 | | | | |_) |  __/ |  \\__ \\ |_| |_| | | |  __/
 \\_| |_/ .__/ \\___|_|  |___/\\__|\\__,_|_|  \\___|
       | |                                     
       |_|   Open-Weight Model Router & Eval Harness
  `);
  logger.info(`Aperture Router listening at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  logger.info(`OpenAI Endpoint:  http://localhost:${port}/v1/chat/completions`);
  logger.info(`Web Dashboard:    http://localhost:${port}/`);
  logger.info(`Metrics API:      http://localhost:${port}/api/metrics`);
  logger.info(`Active Strategy:  ${config.router.defaultStrategy} (Adaptive Tier 1/2/3)`);
});

// Graceful termination handling
const shutdown = () => {
  logger.info('Shutting down Aperture Router...');
  server.close(() => {
    logger.info('Server terminated cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
