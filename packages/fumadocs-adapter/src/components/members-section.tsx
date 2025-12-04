'use client';

import type { OpenPkg, SpecMember } from '@openpkg-ts/spec';

export interface MembersSectionProps {
  members: SpecMember[];
  spec?: OpenPkg;
  title?: string;
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

interface MemberGroups {
  constructors: SpecMember[];
  properties: SpecMember[];
  methods: SpecMember[];
  accessors: SpecMember[];
  other: SpecMember[];
}

function groupMembersByKind(members: SpecMember[]): MemberGroups {
  const groups: MemberGroups = {
    constructors: [],
    properties: [],
    methods: [],
    accessors: [],
    other: [],
  };

  for (const member of members) {
    const kind = member.kind?.toLowerCase() ?? 'other';
    if (kind === 'constructor') {
      groups.constructors.push(member);
    } else if (kind === 'property' || kind === 'field') {
      groups.properties.push(member);
    } else if (kind === 'method' || kind === 'function') {
      groups.methods.push(member);
    } else if (kind === 'getter' || kind === 'setter' || kind === 'accessor') {
      groups.accessors.push(member);
    } else {
      groups.other.push(member);
    }
  }

  return groups;
}

function MemberRow({ member }: { member: SpecMember }) {
  const visibility = member.visibility ?? 'public';
  const isStatic = member.flags?.static;
  const isAbstract = member.flags?.abstract;
  const isReadonly = member.flags?.readonly;

  const badges: string[] = [];
  if (visibility !== 'public') badges.push(visibility);
  if (isStatic) badges.push('static');
  if (isAbstract) badges.push('abstract');
  if (isReadonly) badges.push('readonly');

  const type = formatSchema(member.schema);

  // For methods, show signature
  const sig = member.signatures?.[0];
  let signature = '';
  if (sig) {
    const params =
      sig.parameters?.map((p) => {
        const optional = p.required === false ? '?' : '';
        return `${p.name}${optional}: ${formatSchema(p.schema)}`;
      }) ?? [];
    const returnType = sig.returns?.tsType ?? formatSchema(sig.returns?.schema) ?? 'void';
    signature = `(${params.join(', ')}): ${returnType}`;
  }

  return (
    <div className="py-3 border-b border-fd-border last:border-0">
      <div className="flex items-start gap-2">
        <code className="font-mono text-sm text-fd-primary">
          {member.name}
          {signature}
        </code>
        {badges.length > 0 && (
          <div className="flex gap-1">
            {badges.map((badge) => (
              <span
                key={badge}
                className="text-xs px-1.5 py-0.5 rounded bg-fd-secondary text-fd-muted-foreground"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
      {!signature && type !== 'unknown' && (
        <code className="text-xs text-fd-muted-foreground font-mono mt-1 block">{type}</code>
      )}
      {member.description && (
        <p className="text-sm text-fd-muted-foreground mt-1">{member.description}</p>
      )}
    </div>
  );
}

export function MembersSection({ members, spec, title = 'Members' }: MembersSectionProps) {
  if (!members?.length) return null;

  const groups = groupMembersByKind(members);

  return (
    <div className="my-6">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>

      {groups.constructors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-fd-muted-foreground mb-2 uppercase tracking-wide">
            Constructor
          </h4>
          <div className="rounded-lg border border-fd-border bg-fd-card">
            {groups.constructors.map((member, index) => (
              <MemberRow key={member.name ?? index} member={member} />
            ))}
          </div>
        </div>
      )}

      {groups.properties.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-fd-muted-foreground mb-2 uppercase tracking-wide">
            Properties
          </h4>
          <div className="rounded-lg border border-fd-border bg-fd-card">
            {groups.properties.map((member, index) => (
              <MemberRow key={member.name ?? index} member={member} />
            ))}
          </div>
        </div>
      )}

      {groups.methods.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-fd-muted-foreground mb-2 uppercase tracking-wide">
            Methods
          </h4>
          <div className="rounded-lg border border-fd-border bg-fd-card">
            {groups.methods.map((member, index) => (
              <MemberRow key={member.name ?? index} member={member} />
            ))}
          </div>
        </div>
      )}

      {groups.accessors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-fd-muted-foreground mb-2 uppercase tracking-wide">
            Accessors
          </h4>
          <div className="rounded-lg border border-fd-border bg-fd-card">
            {groups.accessors.map((member, index) => (
              <MemberRow key={member.name ?? index} member={member} />
            ))}
          </div>
        </div>
      )}

      {groups.other.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-fd-muted-foreground mb-2 uppercase tracking-wide">
            Other
          </h4>
          <div className="rounded-lg border border-fd-border bg-fd-card">
            {groups.other.map((member, index) => (
              <MemberRow key={member.name ?? index} member={member} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
