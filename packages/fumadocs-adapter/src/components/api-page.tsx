'use client';

import type { OpenPkg } from '@openpkg-ts/spec';
import type { OpenPkgInstance } from '../server';
import { ClassPage } from './class-page';
import { EnumPage } from './enum-page';
import { FunctionPage } from './function-page';
import { InterfacePage } from './interface-page';
import { VariablePage } from './variable-page';

export interface APIPageProps {
  /** Direct spec object */
  spec?: OpenPkg;
  /** Or server instance from createOpenPkg() */
  instance?: OpenPkgInstance;
  /** Export ID to render */
  id: string;
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="rounded-lg border border-fd-border bg-fd-card p-6 text-center">
      <p className="text-fd-muted-foreground">
        Export <code className="font-mono text-fd-primary">{id}</code> not found in spec.
      </p>
    </div>
  );
}

/**
 * Main API page component that renders documentation for a single export.
 *
 * @example
 * ```tsx
 * import { APIPage } from '@doccov/fumadocs-adapter';
 * import spec from './openpkg.json';
 *
 * <APIPage spec={spec} id="createClient" />
 * ```
 *
 * @example
 * ```tsx
 * // With server instance
 * import { APIPage } from '@doccov/fumadocs-adapter';
 * import { openpkg } from '@/lib/openpkg';
 *
 * <APIPage instance={openpkg} id="createClient" />
 * ```
 */
export function APIPage({ spec, instance, id }: APIPageProps) {
  const resolvedSpec = spec ?? instance?.spec;

  if (!resolvedSpec) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center">
        <p className="text-red-600 dark:text-red-400">
          No spec provided. Pass either <code>spec</code> or <code>instance</code> prop.
        </p>
      </div>
    );
  }

  const exp = resolvedSpec.exports.find((e) => e.id === id);

  if (!exp) {
    return <NotFound id={id} />;
  }

  const pageProps = { export: exp, spec: resolvedSpec };

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
