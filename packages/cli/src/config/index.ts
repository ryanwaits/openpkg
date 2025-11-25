import {
  DOCCOV_CONFIG_FILENAMES,
  loadDocCovConfig,
  loadOpenPkgConfig,
  loadOpenPkgConfigInternal,
} from './openpkg-config';
import type { LoadedDocCovConfig, LoadedOpenPkgConfig } from './openpkg-config';
import type { DocCovConfigInput, NormalizedDocCovConfig, NormalizedOpenPkgConfig } from './schema';

const defineConfig = (config: DocCovConfigInput): DocCovConfigInput => config;

export {
  DOCCOV_CONFIG_FILENAMES,
  defineConfig,
  loadDocCovConfig,
  loadOpenPkgConfig,
  loadOpenPkgConfigInternal,
};
export type {
  DocCovConfigInput,
  LoadedDocCovConfig,
  LoadedOpenPkgConfig,
  NormalizedDocCovConfig,
  NormalizedOpenPkgConfig,
};
