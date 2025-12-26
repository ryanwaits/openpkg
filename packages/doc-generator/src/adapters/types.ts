import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ComponentType, ReactNode } from 'react';

/**
 * Core interface for framework adapters.
 * Each adapter provides framework-specific file generation, components, and config helpers.
 */
export interface DocFrameworkAdapter {
  /** Unique identifier for this adapter */
  name: string;
  /** Display name for documentation */
  displayName: string;
  /** Supported doc framework version(s) */
  version: string;

  /** Generate framework-specific files from spec */
  generate: FileGenerator;
  /** Styled components tailored for the framework */
  components: AdapterComponents;
  /** Config helper for the framework */
  config?: ConfigHelper;
}

/**
 * File generation functions for a doc framework.
 */
export interface FileGenerator {
  /** Generate MDX/MD files for each export */
  pages(spec: OpenPkg, options?: PageGeneratorOptions): GeneratedFile[];
  /** Generate navigation/sidebar config */
  navigation(spec: OpenPkg, options?: NavGeneratorOptions): GeneratedFile;
  /** Generate search index */
  searchIndex?(spec: OpenPkg, options?: SearchGeneratorOptions): GeneratedFile;
}

export interface PageGeneratorOptions {
  /** Output directory for generated files */
  outDir?: string;
  /** Base path for URLs */
  basePath?: string;
  /** Include frontmatter in generated files */
  frontmatter?: boolean;
  /** Group exports by kind, module, or tag */
  groupBy?: 'kind' | 'module' | 'tag' | 'none';
  /** Filter exports to include */
  filter?: (exp: SpecExport) => boolean;
}

export interface NavGeneratorOptions {
  /** Output file path */
  outFile?: string;
  /** Base path for links */
  basePath?: string;
  /** Group navigation items */
  groupBy?: 'kind' | 'module' | 'tag';
  /** Include type definitions in nav */
  includeTypes?: boolean;
}

export interface SearchGeneratorOptions {
  /** Output file path */
  outFile?: string;
  /** Base URL for search results */
  baseUrl?: string;
  /** Fields to include in search index */
  fields?: ('name' | 'description' | 'signature' | 'examples')[];
}

export interface GeneratedFile {
  /** Relative path for the file */
  path: string;
  /** File contents */
  content: string;
  /** File type for logging/display */
  type: 'page' | 'navigation' | 'search' | 'config';
}

/**
 * React components provided by an adapter.
 */
export interface AdapterComponents {
  /** Main API page wrapper */
  APIPage: ComponentType<APIPageComponentProps>;
  /** Function export page */
  FunctionPage: ComponentType<ExportPageProps>;
  /** Class export page */
  ClassPage: ComponentType<ExportPageProps>;
  /** Interface export page */
  InterfacePage: ComponentType<ExportPageProps>;
  /** Enum export page */
  EnumPage: ComponentType<ExportPageProps>;
  /** Variable/constant export page */
  VariablePage: ComponentType<ExportPageProps>;
  /** Type alias export page */
  TypePage?: ComponentType<ExportPageProps>;
}

export interface APIPageComponentProps {
  /** The OpenPkg spec */
  spec: OpenPkg;
  /** Currently selected export ID */
  exportId?: string;
  /** Children to render inside the page */
  children?: ReactNode;
}

export interface ExportPageProps {
  /** The export to render */
  export: SpecExport;
  /** The full spec for type resolution */
  spec?: OpenPkg;
  /** Additional children */
  children?: ReactNode;
}

/**
 * Config helper for integrating with the doc framework.
 */
export interface ConfigHelper {
  /** Generate framework config snippet */
  generateConfig(options?: ConfigOptions): string;
  /** Validate existing config */
  validateConfig?(configPath: string): ConfigValidationResult;
}

export interface ConfigOptions {
  /** Package name for the docs */
  packageName?: string;
  /** Base path for API docs */
  basePath?: string;
  /** Enable search integration */
  search?: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Registry for framework adapters.
 */
export interface AdapterRegistry {
  /** Register a new adapter */
  register(adapter: DocFrameworkAdapter): void;
  /** Get adapter by name */
  get(name: string): DocFrameworkAdapter | undefined;
  /** List all registered adapters */
  list(): DocFrameworkAdapter[];
}

/**
 * Create a new adapter registry.
 */
export function createAdapterRegistry(): AdapterRegistry {
  const adapters = new Map<string, DocFrameworkAdapter>();

  return {
    register(adapter: DocFrameworkAdapter): void {
      adapters.set(adapter.name, adapter);
    },

    get(name: string): DocFrameworkAdapter | undefined {
      return adapters.get(name);
    },

    list(): DocFrameworkAdapter[] {
      return Array.from(adapters.values());
    },
  };
}

/**
 * Default adapter registry instance.
 */
export const adapterRegistry: AdapterRegistry = createAdapterRegistry();
