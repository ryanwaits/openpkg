// index.ts - Tests deep import chains and parent directory imports

import { SharedUtil } from '../shared/utils';
import { CONFIG } from './config/app.config';
import { CoreService } from './services/core';

export class Application {
  private core: CoreService;

  constructor() {
    this.core = new CoreService(CONFIG);
  }

  start(): void {
    const timestamp = SharedUtil.getCurrentTimestamp();
    console.log(`Starting app at ${timestamp}`);
    this.core.initialize();
  }
}
