#!/usr/bin/env node
import { createProgram } from '../src/cli/spec';

const program = createProgram();
program.parse();
