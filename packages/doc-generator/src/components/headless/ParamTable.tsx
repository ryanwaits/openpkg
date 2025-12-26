'use client';

import type { SpecMember, SpecSignatureParameter } from '@openpkg-ts/spec';
import { formatSchema } from '../../core/query';

export interface ParamTableProps {
  /** Parameters or members to display */
  items: (SpecSignatureParameter | SpecMember)[];
  /** Show required indicator */
  showRequired?: boolean;
  /** Custom className */
  className?: string;
  /** Render custom row */
  renderRow?: (item: SpecSignatureParameter | SpecMember, index: number) => React.ReactNode;
}

export interface ParamRowProps {
  item: SpecSignatureParameter | SpecMember;
  showRequired?: boolean;
}

function isParameter(item: SpecSignatureParameter | SpecMember): item is SpecSignatureParameter {
  return 'required' in item;
}

/**
 * Individual parameter row component.
 */
export function ParamRow({ item, showRequired = true }: ParamRowProps): React.ReactNode {
  const name = item.name ?? 'arg';
  const type = formatSchema(item.schema);
  const description = item.description ?? '';
  const required = isParameter(item) ? item.required : true;

  return (
    <tr>
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
}

/**
 * Headless parameter table component.
 *
 * @example
 * ```tsx
 * <ParamTable items={sig.parameters} />
 *
 * // Custom row rendering
 * <ParamTable
 *   items={sig.parameters}
 *   renderRow={(item) => <CustomRow key={item.name} param={item} />}
 * />
 * ```
 */
export function ParamTable({
  items,
  showRequired = true,
  className,
  renderRow,
}: ParamTableProps): React.ReactNode {
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
        {items.map((item, index) =>
          renderRow ? (
            renderRow(item, index)
          ) : (
            <ParamRow key={item.name ?? index} item={item} showRequired={showRequired} />
          ),
        )}
      </tbody>
    </table>
  );
}
