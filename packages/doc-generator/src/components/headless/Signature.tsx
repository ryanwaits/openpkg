'use client';

import type { SpecExport } from '@openpkg-ts/spec';
import { buildSignatureString } from '../../core/query';

export interface SignatureProps {
  /** The export to render signature for */
  export: SpecExport;
  /** Index of signature to render (for overloaded functions) */
  signatureIndex?: number;
  /** Custom className */
  className?: string;
  /** Render prop for custom rendering */
  children?: (signature: string) => React.ReactNode;
}

/**
 * Headless signature component. Renders a type signature string.
 *
 * @example
 * ```tsx
 * // Default rendering
 * <Signature export={fn} />
 *
 * // Custom rendering
 * <Signature export={fn}>
 *   {(sig) => <pre>{sig}</pre>}
 * </Signature>
 * ```
 */
export function Signature({
  export: exp,
  signatureIndex = 0,
  className,
  children,
}: SignatureProps): React.ReactNode {
  const signature = buildSignatureString(exp, signatureIndex);

  if (children) {
    return children(signature);
  }

  return <code className={className}>{signature}</code>;
}
