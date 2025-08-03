// services/core.ts - Imports from nested directories

import type { AppConfig } from '../config/app.config';
import { Logger } from '../utils/logger';
import { DatabaseService } from './database/db-service';

export class CoreService {
  private db: DatabaseService;
  private logger: Logger;

  constructor(config: AppConfig) {
    this.db = new DatabaseService(config.database);
    this.logger = new Logger('CoreService');
  }

  initialize(): void {
    this.logger.info('Initializing core service...');
    this.db.connect();
  }
}
