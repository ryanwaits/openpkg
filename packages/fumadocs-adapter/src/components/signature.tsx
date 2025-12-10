'use client';

import { ClientDocsKitCode } from '@doccov/ui/docskit';
import type { SpecExport, SpecSignature, SpecTypeParameter } from '@openpkg-ts/spec';
import type { RawCode } from 'codehike/code';

export interface SignatureProps {
  export: SpecExport;
  signatureIndex?: number;
}

function formatTypeParameters(typeParams?: SpecTypeParameter[]): string {
  if (!typeParams?.length) return '';
  const params = typeParams.map((tp) => {
    let str = tp.name;
    if (tp.constraint) str += ` extends ${tp.constraint}`;
    if (tp.default) str += ` = ${tp.default}`;
    return str;
  });
  return `<${params.join(', ')}>`;
}

function formatParameters(sig?: SpecSignature): string {
  if (!sig?.parameters?.length) return '()';
  const params = sig.parameters.map((p) => {
    const optional = p.required === false ? '?' : '';
    const type = formatSchema(p.schema);
    return `${p.name}${optional}: ${type}`;
  });
  return `(${params.join(', ')})`;
}

function formatSchema(schema: unknown): string {
  if (!schema) return 'unknown';
  if (typeof schema === 'string') return schema;
  if (typeof schema === 'object' && schema !== null) {
    const s = schema as Record<string, unknown>;
    if (s.$ref && typeof s.$ref === 'string') {
      return s.$ref.replace('#/types/', '');
    }
    if (s.tsType) return String(s.tsType);
    if (s.type) return String(s.type);
  }
  return 'unknown';
}

function formatReturnType(sig?: SpecSignature): string {
  if (!sig?.returns) return 'void';
  if (sig.returns.tsType) return sig.returns.tsType;
  return formatSchema(sig.returns.schema);
}

function buildSignatureString(exp: SpecExport, sigIndex = 0): string {
  const sig = exp.signatures?.[sigIndex];
  const typeParams = formatTypeParameters(exp.typeParameters || sig?.typeParameters);

  switch (exp.kind) {
    case 'function': {
      const params = formatParameters(sig);
      const returnType = formatReturnType(sig);
      return `function ${exp.name}${typeParams}${params}: ${returnType}`;
    }
    case 'class': {
      const ext = exp.extends ? ` extends ${exp.extends}` : '';
      const impl = exp.implements?.length ? ` implements ${exp.implements.join(', ')}` : '';
      return `class ${exp.name}${typeParams}${ext}${impl}`;
    }
    case 'interface': {
      const ext = exp.extends ? ` extends ${exp.extends}` : '';
      return `interface ${exp.name}${typeParams}${ext}`;
    }
    case 'type': {
      const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
      return `type ${exp.name}${typeParams} = ${typeValue}`;
    }
    case 'enum': {
      return `enum ${exp.name}`;
    }
    case 'variable': {
      const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
      return `const ${exp.name}: ${typeValue}`;
    }
    default:
      return exp.name;
  }
}

export function Signature({ export: exp, signatureIndex = 0 }: SignatureProps): React.ReactNode {
  const signature = buildSignatureString(exp, signatureIndex);

  // Build RawCode for syntax highlighting
  const codeblock: RawCode = {
    value: signature,
    lang: 'typescript',
    meta: 'c', // copyButton flag
  };

  return (
    <div className="not-prose">
      <ClientDocsKitCode codeblock={codeblock} />
      {exp.deprecated && (
        <div className="mt-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
          <strong>Deprecated:</strong> This export is deprecated.
        </div>
      )}
    </div>
  );
}
