import type { LoadedDocCovConfig } from './doccov-config';
import { DOCCOV_CONFIG_FILENAMES, loadDocCovConfig } from './doccov-config';
import type { CheckConfig, DocCovConfigInput, DocsConfig, LintRulesConfig, NormalizedDocCovConfig } from './schema';

const defineConfig = (config: DocCovConfigInput): DocCovConfigInput => config;

export { DOCCOV_CONFIG_FILENAMES, defineConfig, loadDocCovConfig };
export type { CheckConfig, DocCovConfigInput, DocsConfig, LintRulesConfig, LoadedDocCovConfig, NormalizedDocCovConfig };
