import type { LoadedDocCovConfig } from './doccov-config';
import { DOCCOV_CONFIG_FILENAMES, loadDocCovConfig } from './doccov-config';
import type { DocCovConfigInput, DocsConfig, NormalizedDocCovConfig } from './schema';

const defineConfig = (config: DocCovConfigInput): DocCovConfigInput => config;

export { DOCCOV_CONFIG_FILENAMES, defineConfig, loadDocCovConfig };
export type { DocCovConfigInput, DocsConfig, LoadedDocCovConfig, NormalizedDocCovConfig };
