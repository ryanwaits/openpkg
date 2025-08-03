// config/app.config.ts - Configuration with nested types
import type { DatabaseConfig } from '../services/database/db-service';

export interface AppConfig {
  name: string;
  version: string;
  database: DatabaseConfig;
}

export const CONFIG: AppConfig = {
  name: 'MyApp',
  version: '1.0.0',
  database: {
    host: 'localhost',
    port: 5432,
    name: 'myapp_db',
  },
};
