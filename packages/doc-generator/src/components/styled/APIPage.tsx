'use client';

import type { OpenPkg } from '@openpkg-ts/spec';
import type { DocsInstance } from '../../core/loader';
import { ClassPage } from './ClassPage';
import { EnumPage } from './EnumPage';
import { FunctionPage } from './FunctionPage';
import { InterfacePage } from './InterfacePage';
import { VariablePage } from './VariablePage';

export interface APIPageProps {
  /** Direct spec object */
  spec?: OpenPkg;
  /** Or docs instance from createDocs() */
  instance?: DocsInstance;
  /** Export ID to render */
  id: string;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => React.ReactNode;
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-center">
      <p className="text-muted-foreground">
        Export <code className="font-mono text-primary">{id}</code> not found in spec.
      </p>
    </div>
  );
}

function NoSpec() {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center">
      <p className="text-red-600 dark:text-red-400">
        No spec provided. Pass either <code>spec</code> or <code>instance</code> prop.
      </p>
    </div>
  );
}

/**
 * Main styled API page component that renders documentation for a single export.
 *
 * @example
 * ```tsx
 * import { APIPage } from '@openpkg-ts/doc-generator/react/styled'
 * import spec from './openpkg.json'
 *
 * <APIPage spec={spec} id="createClient" />
 * ```
 *
 * @example
 * ```tsx
 * // With docs instance
 * import { APIPage } from '@openpkg-ts/doc-generator/react/styled'
 * import { createDocs } from '@openpkg-ts/doc-generator'
 *
 * const docs = createDocs('./openpkg.json')
 * <APIPage instance={docs} id="createClient" />
 * ```
 */
export function APIPage({ spec, instance, id, renderExample }: APIPageProps): React.ReactNode {
  const resolvedSpec = spec ?? instance?.spec;

  if (!resolvedSpec) {
    return <NoSpec />;
  }

  const exp = resolvedSpec.exports.find((e) => e.id === id);

  if (!exp) {
    return <NotFound id={id} />;
  }

  const pageProps = { export: exp, spec: resolvedSpec, renderExample };

  switch (exp.kind) {
    case 'function':
      return <FunctionPage {...pageProps} />;
    case 'class':
      return <ClassPage {...pageProps} />;
    case 'interface':
    case 'type':
      return <InterfacePage {...pageProps} />;
    case 'enum':
      return <EnumPage {...pageProps} />;
    default:
      return <VariablePage {...pageProps} />;
  }
}
