// services/database/db-service.ts - Deeply nested file
import { Logger } from '../../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
}

export class DatabaseService {
  private logger: Logger;
  
  constructor(private config: DatabaseConfig) {
    this.logger = new Logger('DatabaseService');
  }
  
  connect(): void {
    this.logger.info(`Connecting to ${this.config.host}:${this.config.port}`);
  }
}