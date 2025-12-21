'use client';

import { Breadcrumb } from '@doccov/ui/breadcrumb';
import {
  DRIFT_SEVERITY_MAP,
  DriftCommandCenter,
  type DriftIssue,
} from '@doccov/ui/drift-command-center';
import { useRouter } from 'next/navigation';

// Demo data - in production this would come from the API
const demoIssues: DriftIssue[] = [
  {
    id: '1',
    type: 'example-runtime-error',
    severity: DRIFT_SEVERITY_MAP['example-runtime-error'],
    description:
      'The example code throws a TypeError when executed. The config parameter is missing required fields.',
    filePath: 'src/client.ts',
    line: 12,
    exportName: 'createClient',
    isAutoFixable: true,
    suggestedFix: {
      before: 'const client = createClient({});',
      after: 'const client = createClient({ baseUrl: "https://api.example.com" });',
    },
    status: 'pending',
  },
  {
    id: '2',
    type: 'return-type-mismatch',
    severity: DRIFT_SEVERITY_MAP['return-type-mismatch'],
    description: 'The @returns tag says {User} but the function actually returns Promise<User>.',
    filePath: 'src/api.ts',
    line: 45,
    exportName: 'fetchUser',
    isAutoFixable: true,
    suggestedFix: {
      before: '@returns {User}',
      after: '@returns {Promise<User>}',
    },
    status: 'pending',
  },
  {
    id: '3',
    type: 'example-assertion-failed',
    severity: DRIFT_SEVERITY_MAP['example-assertion-failed'],
    description: 'Example assertion failed: expected 0.3 but got 0.30000000000000004.',
    filePath: 'src/math.ts',
    line: 28,
    exportName: 'add',
    isAutoFixable: false,
    status: 'pending',
  },
  {
    id: '4',
    type: 'param-mismatch',
    severity: DRIFT_SEVERITY_MAP['param-mismatch'],
    description:
      'The parameter @param userId is documented but the actual function signature has id.',
    filePath: 'src/client.ts',
    line: 42,
    exportName: 'getUser',
    isAutoFixable: true,
    suggestedFix: {
      before: '@param userId',
      after: '@param id',
    },
    status: 'pending',
  },
  {
    id: '5',
    type: 'param-mismatch',
    severity: DRIFT_SEVERITY_MAP['param-mismatch'],
    description:
      'The parameter @param dateString is documented but the function expects a Date object.',
    filePath: 'src/utils/format.ts',
    line: 18,
    exportName: 'formatDate',
    isAutoFixable: true,
    status: 'pending',
  },
  {
    id: '6',
    type: 'param-type-mismatch',
    severity: DRIFT_SEVERITY_MAP['param-type-mismatch'],
    description: 'Parameter type mismatch: @param {string} but signature shows number.',
    filePath: 'src/utils/parse.ts',
    line: 55,
    exportName: 'parseId',
    isAutoFixable: true,
    status: 'pending',
  },
  {
    id: '7',
    type: 'optionality-mismatch',
    severity: DRIFT_SEVERITY_MAP['optionality-mismatch'],
    description:
      'The parameter @param options is documented as required but is actually optional in the signature.',
    filePath: 'src/config.ts',
    line: 87,
    exportName: 'createConfig',
    isAutoFixable: true,
    status: 'pending',
  },
  {
    id: '8',
    type: 'deprecated-mismatch',
    severity: DRIFT_SEVERITY_MAP['deprecated-mismatch'],
    description:
      'The function is marked @deprecated in code but the documentation does not mention deprecation.',
    filePath: 'src/legacy.ts',
    line: 23,
    exportName: 'oldMethod',
    isAutoFixable: true,
    status: 'pending',
  },
  {
    id: '9',
    type: 'visibility-mismatch',
    severity: DRIFT_SEVERITY_MAP['visibility-mismatch'],
    description: 'The function is marked @internal but is exported from the public API.',
    filePath: 'src/internal.ts',
    line: 156,
    exportName: '_internalHelper',
    isAutoFixable: false,
    status: 'pending',
  },
  {
    id: '10',
    type: 'broken-link',
    severity: DRIFT_SEVERITY_MAP['broken-link'],
    description: 'The documentation links to https://example.com/old-docs which returns a 404.',
    filePath: 'src/client.ts',
    line: 8,
    isAutoFixable: false,
    status: 'pending',
  },
  {
    id: '11',
    type: 'async-mismatch',
    severity: DRIFT_SEVERITY_MAP['async-mismatch'],
    description: 'Documentation says synchronous but function is async.',
    filePath: 'src/data.ts',
    line: 34,
    exportName: 'loadData',
    isAutoFixable: true,
    status: 'pending',
  },
  {
    id: '12',
    type: 'param-mismatch',
    severity: DRIFT_SEVERITY_MAP['param-mismatch'],
    description: 'Missing @param for callback parameter.',
    filePath: 'src/events.ts',
    line: 12,
    exportName: 'onEvent',
    isAutoFixable: true,
    status: 'pending',
  },
  {
    id: '13',
    type: 'return-type-mismatch',
    severity: DRIFT_SEVERITY_MAP['return-type-mismatch'],
    description: '@returns {void} but function returns boolean.',
    filePath: 'src/validation.ts',
    line: 67,
    exportName: 'validate',
    isAutoFixable: true,
    status: 'pending',
  },
  {
    id: '14',
    type: 'param-type-mismatch',
    severity: DRIFT_SEVERITY_MAP['param-type-mismatch'],
    description: '@param {object} options but type is ConfigOptions interface.',
    filePath: 'src/config.ts',
    line: 23,
    exportName: 'configure',
    isAutoFixable: true,
    status: 'pending',
  },
  {
    id: '15',
    type: 'broken-link',
    severity: DRIFT_SEVERITY_MAP['broken-link'],
    description: 'Link to deprecated API reference page.',
    filePath: 'src/api.ts',
    line: 3,
    isAutoFixable: false,
    status: 'pending',
  },
];

export default function DriftPage() {
  const router = useRouter();

  const handleViewIssue = (issue: DriftIssue) => {
    console.log('View issue:', issue.id);
    // Could open a modal or navigate to detailed view
  };

  const handleFixIssue = (issue: DriftIssue) => {
    console.log('Fix issue:', issue.id);
    // Navigate to fix workflow with this issue
    router.push(`/fix?issue=${issue.id}`);
  };

  const handleIgnoreIssue = (issue: DriftIssue) => {
    console.log('Ignore issue:', issue.id);
    // In production, would call API to mark as ignored
  };

  const handleFixAllAutoFixable = () => {
    console.log('Fix all auto-fixable');
    // Navigate to fix workflow with all auto-fixable issues
    router.push('/fix?autofix=all');
  };

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { id: 'packages', label: 'Packages', href: '/dashboard' },
            { id: 'pkg', label: 'zod-openapi', href: '/packages/zod-openapi' },
            { id: 'drift', label: 'Drift', hasDropdown: false },
          ]}
        />
      </div>

      {/* Command Center */}
      <DriftCommandCenter
        issues={demoIssues}
        packageName="zod-openapi"
        onViewIssue={handleViewIssue}
        onFixIssue={handleFixIssue}
        onIgnoreIssue={handleIgnoreIssue}
        onFixAllAutoFixable={handleFixAllAutoFixable}
      />
    </div>
  );
}
