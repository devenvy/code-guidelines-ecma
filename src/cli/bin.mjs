#!/usr/bin/env node
import process from 'node:process';

import { run } from './index.mjs';

const [, , ...args] = process.argv;
const { code, output } = await run(args, process.cwd());
console.log(output.join('\n'));
process.exitCode = code;
