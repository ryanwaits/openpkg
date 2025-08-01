// services/core.ts - Imports from nested directories
import { DatabaseService } from './database/db-service';
import { Logger } from '../utils/logger';
import { AppConfig } from '../config/app.config';

export class CoreService {
  private db: DatabaseService;
  private logger: Logger;
  
  constructor(private config: AppConfig) {
    this.db = new DatabaseService(config.database);
    this.logger = new Logger('CoreService');
  }
  
  initialize(): void {
    this.logger.info('Initializing core service...');
    this.db.connect();
  }
}