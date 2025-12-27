// CoverageBadge is doccov-specific, stays in fumadocs-adapter

// Re-export headless components from doc-generator
export {
  CollapsibleMethod,
  type CollapsibleMethodProps,
  ExampleBlock,
  type ExampleBlockProps,
  ExpandableProperty,
  type ExpandablePropertyProps,
  MemberRow,
  type MemberRowProps,
  MembersTable,
  type MembersTableProps,
  NestedProperty,
  type NestedPropertyProps,
  ParamRow,
  type ParamRowProps,
  ParamTable,
  type ParamTableProps,
  Signature,
  type SignatureProps,
  TypeTable,
  type TypeTableProps,
} from '@openpkg-ts/doc-generator/react';
// Re-export all styled components from doc-generator
export {
  APIPage,
  type APIPageProps,
  ClassPage,
  type ClassPageProps,
  CodeTabs,
  type CodeTab,
  type CodeTabsProps,
  EnumPage,
  type EnumPageProps,
  ExportCard,
  type ExportCardProps,
  ExportIndexPage,
  type ExportIndexPageProps,
  FunctionPage,
  type FunctionPageProps,
  ImportSection,
  type ImportSectionProps,
  InterfacePage,
  type InterfacePageProps,
  ParameterItem,
  type NestedPropertyItemProps,
  type ParameterItemProps,
  VariablePage,
  type VariablePageProps,
} from '@openpkg-ts/doc-generator/react/styled';
export type { CoverageBadgeProps, DocDrift, DocsMetadata } from './coverage-badge';
export { CoverageBadge } from './coverage-badge';
