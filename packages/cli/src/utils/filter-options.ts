import chalk from 'chalk';
import type { NormalizedOpenPkgConfig } from '../config';

export interface FilterOptions {
  include?: string[];
  exclude?: string[];
}

export interface ResolvedFilterOptions {
  include?: string[];
  exclude?: string[];
  source?: 'config' | 'cli' | 'combined';
  messages: string[];
}

const unique = (values: string[]): string[] => Array.from(new Set(values));

export const parseListFlag = (value?: string | string[]): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const rawItems = Array.isArray(value) ? value : [value];
  const normalized = rawItems
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? unique(normalized) : undefined;
};

const formatList = (label: string, values: string[]): string =>
  `${label}: ${values.map((value) => chalk.cyan(value)).join(', ')}`;

export const mergeFilterOptions = (
  config: NormalizedOpenPkgConfig | null,
  cliOptions: FilterOptions,
): ResolvedFilterOptions => {
  const messages: string[] = [];

  const configInclude = config?.include;
  const configExclude = config?.exclude;
  const cliInclude = cliOptions.include;
  const cliExclude = cliOptions.exclude;

  let include: string[] | undefined = configInclude;
  let exclude: string[] | undefined = configExclude;
  let source: ResolvedFilterOptions['source'] = include || exclude ? 'config' : undefined;

  if (configInclude) {
    messages.push(formatList('include filters from config', configInclude));
  }

  if (configExclude) {
    messages.push(formatList('exclude filters from config', configExclude));
  }

  if (cliInclude) {
    include = include ? include.filter((item) => cliInclude.includes(item)) : cliInclude;
    source = include ? 'combined' : 'cli';
    messages.push(formatList('apply include filters from CLI', cliInclude));
  }

  if (cliExclude) {
    exclude = exclude ? unique([...exclude, ...cliExclude]) : cliExclude;
    source = source ? 'combined' : 'cli';
    messages.push(formatList('apply exclude filters from CLI', cliExclude));
  }

  include = include ? unique(include) : undefined;
  exclude = exclude ? unique(exclude) : undefined;

  if (!include && !exclude) {
    return { messages };
  }

  return {
    include,
    exclude,
    source,
    messages,
  };
};
