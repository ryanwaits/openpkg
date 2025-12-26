'use client';

import type { SpecMember, SpecSignatureParameter } from '@openpkg-ts/spec';
import { formatSchema } from '../../core/query';

export interface TypeTableProps {
  /** Members or parameters to display */
  items: (SpecSignatureParameter | SpecMember)[];
  /** Show required indicator */
  showRequired?: boolean;
  /** Custom className */
  className?: string;
  /** Render custom row */
  renderRow?: (item: SpecSignatureParameter | SpecMember, index: number) => React.ReactNode;
}

function isParameter(item: SpecSignatureParameter | SpecMember): item is SpecSignatureParameter {
  return 'required' in item;
}

/**
 * Headless type table for displaying interface/type members.
 *
 * @example
 * ```tsx
 * <TypeTable items={exp.members} />
 * ```
 */
export function TypeTable({
  items,
  showRequired = true,
  className,
  renderRow,
}: TypeTableProps): React.ReactNode {
  if (!items?.length) return null;

  return (
    <table className={className}>
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => {
          if (renderRow) {
            return renderRow(item, index);
          }

          const name = item.name ?? `arg${index}`;
          const type = formatSchema(item.schema);
          const description = item.description ?? '';
          const required = isParameter(item) ? item.required : true;

          return (
            <tr key={name}>
              <td>
                <code>{name}</code>
                {showRequired && required && <span>*</span>}
                {showRequired && !required && <span>?</span>}
              </td>
              <td>
                <code>{type}</code>
              </td>
              <td>{description}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
