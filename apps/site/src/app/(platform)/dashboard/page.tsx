'use client';

import { Breadcrumb } from '@doccov/ui/breadcrumb';
import { Button } from '@doccov/ui/button';
import { FileChangeList, FileChangeRow } from '@doccov/ui/file-change-row';
import { FileChip } from '@doccov/ui/file-chip';
import { SegmentedTabs, type TabCell } from '@doccov/ui/tabs';
import { ArrowRight, Plus } from 'lucide-react';
import { useState } from 'react';
import {
  type CoverageDataPoint,
  type CoverageInsight,
  CoverageTrends,
  type SignalDataPoint,
} from '@/components/coverage-trends';
import { UpgradeCard } from '@/components/upgrade-card';
import { useAuth } from '@/lib/auth-context';

// Mock coverage trend data
const mockCoverageData: CoverageDataPoint[] = [
  {
    version: 'v1.0',
    date: 'Oct 15',
    coverageScore: 45,
    documentedExports: 9,
    totalExports: 20,
    driftCount: 0,
  },
  {
    version: 'v1.1',
    date: 'Oct 22',
    coverageScore: 52,
    documentedExports: 13,
    totalExports: 25,
    driftCount: 1,
  },
  {
    version: 'v1.2',
    date: 'Oct 29',
    coverageScore: 61,
    documentedExports: 22,
    totalExports: 36,
    driftCount: 2,
  },
  {
    version: 'v1.3',
    date: 'Nov 5',
    coverageScore: 68,
    documentedExports: 34,
    totalExports: 50,
    driftCount: 1,
  },
  {
    version: 'v1.4',
    date: 'Nov 12',
    coverageScore: 72,
    documentedExports: 43,
    totalExports: 60,
    driftCount: 3,
  },
  {
    version: 'v1.5',
    date: 'Nov 19',
    coverageScore: 78,
    documentedExports: 55,
    totalExports: 70,
    driftCount: 2,
  },
  {
    version: 'v1.6',
    date: 'Nov 26',
    coverageScore: 74,
    documentedExports: 59,
    totalExports: 80,
    driftCount: 5,
  },
  {
    version: 'v1.7',
    date: 'Dec 3',
    coverageScore: 82,
    documentedExports: 74,
    totalExports: 90,
    driftCount: 2,
  },
];

const mockSignalData: SignalDataPoint[] = [
  {
    version: 'v1.0',
    date: 'Oct 15',
    descriptionPercent: 60,
    paramsPercent: 35,
    returnsPercent: 25,
    examplesPercent: 10,
  },
  {
    version: 'v1.1',
    date: 'Oct 22',
    descriptionPercent: 65,
    paramsPercent: 42,
    returnsPercent: 30,
    examplesPercent: 15,
  },
  {
    version: 'v1.2',
    date: 'Oct 29',
    descriptionPercent: 72,
    paramsPercent: 50,
    returnsPercent: 38,
    examplesPercent: 20,
  },
  {
    version: 'v1.3',
    date: 'Nov 5',
    descriptionPercent: 78,
    paramsPercent: 58,
    returnsPercent: 45,
    examplesPercent: 25,
  },
  {
    version: 'v1.4',
    date: 'Nov 12',
    descriptionPercent: 82,
    paramsPercent: 65,
    returnsPercent: 52,
    examplesPercent: 30,
  },
  {
    version: 'v1.5',
    date: 'Nov 19',
    descriptionPercent: 88,
    paramsPercent: 72,
    returnsPercent: 60,
    examplesPercent: 38,
  },
  {
    version: 'v1.6',
    date: 'Nov 26',
    descriptionPercent: 85,
    paramsPercent: 68,
    returnsPercent: 55,
    examplesPercent: 35,
  },
  {
    version: 'v1.7',
    date: 'Dec 3',
    descriptionPercent: 92,
    paramsPercent: 78,
    returnsPercent: 68,
    examplesPercent: 45,
  },
];

const mockInsights: CoverageInsight[] = [
  { type: 'improvement', message: 'Coverage increased 37% since v1.0', severity: 'success' },
  {
    type: 'regression',
    message: '3 exports lost documentation in v1.6 (recovered in v1.7)',
    severity: 'warning',
  },
  {
    type: 'prediction',
    message: 'At current pace, 100% coverage in ~3 releases',
    severity: 'info',
  },
];

// Mock data - packages with undocumented exports
const mockPackages = [
  {
    slug: 'doccov-cli',
    name: '@doccov/cli',
    coverage: 92,
    documented: 46,
    total: 50,
    lastRun: '30m ago',
    undocumented: [
      { path: 'src/commands/', filename: 'init.ts', exports: 2 },
      { path: 'src/utils/', filename: 'config.ts', exports: 2 },
    ],
  },
  {
    slug: 'zod-openapi',
    name: 'zod-openapi',
    coverage: 78,
    documented: 156,
    total: 200,
    lastRun: '2h ago',
    undocumented: [
      { path: 'src/schemas/', filename: 'response.ts', exports: 12 },
      { path: 'src/utils/', filename: 'helpers.ts', exports: 8 },
      { path: 'src/types/', filename: 'index.ts', exports: 24 },
    ],
  },
  {
    slug: 'footnote',
    name: 'footnote',
    coverage: 45,
    documented: 9,
    total: 20,
    lastRun: '1d ago',
    undocumented: [
      { path: 'src/', filename: 'footnote.ts', exports: 6 },
      { path: 'src/utils/', filename: 'parser.ts', exports: 5 },
    ],
  },
];

export default function Dashboard() {
  const { currentOrg } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [activePackage, setActivePackage] = useState(mockPackages[0].slug);
  const isFreeUser = !currentOrg || currentOrg.plan === 'free';

  const tabs: TabCell[] = [
    { id: 'overview', type: 'text', label: 'Overview' },
    { id: 'trends', type: 'text', label: 'Trends' },
    { id: 'undocumented', type: 'count', label: 'Undocumented', count: 39 },
  ];

  const currentPackage = mockPackages.find((p) => p.slug === activePackage) || mockPackages[0];
  const totalUndocumented = mockPackages.reduce((sum, p) => sum + (p.total - p.documented), 0);
  const avgCoverage = Math.round(
    mockPackages.reduce((sum, p) => sum + p.coverage, 0) / mockPackages.length,
  );

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Breadcrumb items={[{ id: 'dashboard', label: 'Dashboard', hasDropdown: false }]} />
        <Button variant="secondary" size="sm" leftIcon={<Plus className="size-4" />}>
          New package
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <SegmentedTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="text-sm text-foreground">
            <p>
              Tracking <span className="font-medium">{mockPackages.length} packages</span> with{' '}
              <span className="font-medium tabular-nums">{avgCoverage}%</span> average coverage.{' '}
              <span className="text-muted-foreground">
                {totalUndocumented} exports missing documentation.
              </span>
            </p>
          </div>

          {/* Packages List */}
          <FileChangeList title="Packages" count={mockPackages.length} defaultOpen>
            {mockPackages.map((pkg) => (
              <FileChangeRow
                key={pkg.slug}
                path=""
                filename={pkg.name}
                additions={pkg.documented}
                deletions={pkg.total - pkg.documented}
              >
                <div className="space-y-3">
                  <div className="text-sm text-foreground">
                    <span className="font-medium tabular-nums">
                      {Math.round((pkg.documented / pkg.total) * 100)}%
                    </span>{' '}
                    coverage — {pkg.total - pkg.documented} exports missing documentation in{' '}
                    {pkg.undocumented.length} files:
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {pkg.undocumented.map((file) => (
                      <FileChip key={file.filename} filename={file.filename} />
                    ))}
                  </div>
                  <a
                    href={`/packages/${pkg.slug}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View details
                    <ArrowRight className="size-3.5" />
                  </a>
                </div>
              </FileChangeRow>
            ))}
          </FileChangeList>
        </div>
      )}

      {activeTab === 'trends' &&
        (isFreeUser ? (
          <UpgradeCard feature="trends" />
        ) : (
          <CoverageTrends
            data={mockCoverageData}
            signalData={mockSignalData}
            insights={mockInsights}
            regression={{
              fromVersion: 'v1.5',
              toVersion: 'v1.6',
              coverageDrop: 4,
              exportsLost: 3,
            }}
          />
        ))}

      {activeTab === 'undocumented' && (
        <div className="space-y-6">
          {/* Package selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Package:</span>
            <SegmentedTabs
              tabs={mockPackages.map((p) => ({
                id: p.slug,
                type: 'text' as const,
                label: p.name,
              }))}
              activeTab={activePackage}
              onTabChange={setActivePackage}
            />
          </div>

          {/* Summary for selected package */}
          <div className="text-sm text-foreground">
            <p>
              <span className="font-medium">
                {currentPackage.total - currentPackage.documented}
              </span>{' '}
              undocumented exports in <span className="font-medium">{currentPackage.name}</span>.{' '}
              <span className="text-muted-foreground">
                Found in {currentPackage.undocumented.length} files:
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {currentPackage.undocumented.map((file) => (
                <FileChip key={file.filename} filename={file.filename} />
              ))}
            </div>
          </div>

          {/* File list */}
          <FileChangeList
            title="Files with missing docs"
            count={currentPackage.undocumented.length}
            defaultOpen
          >
            {currentPackage.undocumented.map((file) => (
              <FileChangeRow
                key={file.filename}
                path={file.path}
                filename={file.filename}
                deletions={file.exports}
              />
            ))}
          </FileChangeList>
        </div>
      )}
    </div>
  );
}
