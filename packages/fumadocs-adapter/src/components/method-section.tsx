'use client';

import type { SpecMember } from '@openpkg-ts/spec';
import { CollapsibleMethod } from './collapsible-method';

export interface MethodSectionProps {
  member: SpecMember;
  /** @deprecated Use CollapsibleMethod directly with defaultExpanded */
  defaultExpanded?: boolean;
}

/**
 * Method display section with collapsible behavior
 * @deprecated Use CollapsibleMethod directly for more control
 */
export function MethodSection({ member, defaultExpanded = false }: MethodSectionProps) {
  return <CollapsibleMethod member={member} defaultExpanded={defaultExpanded} />;
}
