#!/usr/bin/env node

/**
 * FuncDock CLI — Unified command-line interface for the FuncDock FaaS platform
 *
 * Usage: funcdock <command> [options]
 */

import { cli } from '../cli/index.js';

cli(process.argv.slice(2)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
