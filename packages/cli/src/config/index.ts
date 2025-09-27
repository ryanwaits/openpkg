import { loadOpenPkgConfigInternal } from './openpkg-config';
import type { OpenPkgConfigInput } from './schema';

export type { LoadedOpenPkgConfig } from './openpkg-config';
export type { NormalizedOpenPkgConfig } from './schema';

const define = (config: OpenPkgConfigInput): OpenPkgConfigInput => config;

export { loadOpenPkgConfigInternal as loadOpenPkgConfig, define as defineConfig };
