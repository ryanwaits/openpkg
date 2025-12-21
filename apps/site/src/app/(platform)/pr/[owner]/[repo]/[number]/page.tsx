'use client';

import { type PRCoverageData, PRCoverageView } from '@doccov/ui/pr-coverage';
import { useParams } from 'next/navigation';

// Mock data for demonstration
const mockData: PRCoverageData = {
  pr: {
    number: 142,
    title: 'Add user authentication flow',
    base: 'main',
    head: 'feature/auth',
    author: 'developer',
    authorUrl: 'https://github.com/developer',
    url: 'https://github.com/acme/pkg/pull/142',
    openedAt: '2h ago',
  },
  status: 'passing',
  updatedAt: '5 minutes ago',
  metrics: {
    patchCoverage: 86,
    patchCoverageTarget: 80,
    projectCoverage: {
      before: 72,
      after: 74,
    },
    newExports: {
      total: 4,
      documented: 2,
      undocumented: 2,
    },
    driftDelta: {
      introduced: 2,
      resolved: 1,
    },
  },
  changes: [
    {
      path: 'src/auth/',
      filename: 'index.ts',
      stats: { added: 4 },
      exports: [
        {
          name: 'createUser',
          kind: 'function',
          changeType: '+',
          coverage: 100,
          status: 'documented',
        },
        {
          name: 'validateToken',
          kind: 'function',
          changeType: '+',
          coverage: 100,
          status: 'documented',
        },
        {
          name: 'AuthOptions',
          kind: 'interface',
          changeType: '+',
          coverage: 50,
          status: 'partial',
          missing: ['missing @example'],
          line: 12,
        },
        {
          name: 'hashPassword',
          kind: 'function',
          changeType: '+',
          coverage: 0,
          status: 'undocumented',
          missing: ['description', '@param password', '@returns', '@example'],
          line: 45,
        },
      ],
    },
    {
      path: 'src/auth/',
      filename: 'tokens.ts',
      stats: { modified: 2 },
      exports: [
        {
          name: 'refreshToken',
          kind: 'function',
          changeType: '~',
          coverage: 75,
          status: 'partial',
          missing: ['missing @returns'],
          line: 15,
        },
        {
          name: 'TokenPayload',
          kind: 'type',
          changeType: '~',
          coverage: 100,
          status: 'documented',
        },
      ],
    },
  ],
  drift: {
    introduced: [
      {
        id: 'drift-1',
        type: 'param-mismatch',
        severity: 'medium',
        description: 'validateToken(): @param token documented, but signature has jwt',
        filePath: 'src/auth/index.ts',
        line: 28,
        functionName: 'validateToken',
      },
      {
        id: 'drift-2',
        type: 'return-type-mismatch',
        severity: 'medium',
        description: 'refreshToken(): @returns User but function returns Promise<Token>',
        filePath: 'src/auth/tokens.ts',
        line: 15,
        functionName: 'refreshToken',
      },
    ],
    resolved: [
      {
        id: 'drift-3',
        type: 'param-mismatch',
        severity: 'medium',
        description: 'createUser(): @param data → @param user',
        filePath: 'src/auth/index.ts',
        line: 10,
        functionName: 'createUser',
        status: 'resolved',
      },
    ],
  },
  docsImpact: [
    {
      path: 'docs/authentication.md',
      issues: [
        {
          line: 42,
          description: 'createUser() signature changed',
          before: 'createUser(data: UserData)',
          after: 'createUser(user: CreateUserInput)',
        },
        {
          line: 78,
          description: 'validateToken example uses old API',
          before: 'validateToken(token)',
          after: 'validateToken(jwt: string)',
        },
      ],
    },
    {
      path: 'README.md',
      issues: [
        {
          line: 24,
          description: 'Quick start example outdated',
        },
      ],
    },
  ],
};

export default function PRCoveragePage() {
  const params = useParams();
  const { owner, repo, number } = params as { owner: string; repo: string; number: string };

  // In real app, fetch data based on params
  const data = {
    ...mockData,
    pr: {
      ...mockData.pr,
      number: parseInt(number, 10) || mockData.pr.number,
      url: `https://github.com/${owner}/${repo}/pull/${number}`,
    },
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PRCoverageView
        data={data}
        onViewGitHub={() => window.open(data.pr.url, '_blank')}
        onRerunAnalysis={() => console.log('Re-run analysis')}
        onFixIssues={() => console.log('Fix issues')}
        onViewSource={(filePath, line) => console.log('View source:', filePath, line)}
        onAddDocs={(filePath, exportName) => console.log('Add docs:', filePath, exportName)}
        onFixDrift={(issue) => console.log('Fix drift:', issue)}
        onViewDrift={(issue) => console.log('View drift:', issue)}
        onFixAllDrift={() => console.log('Fix all drift')}
        onOpenDocsFile={(path) => console.log('Open docs:', path)}
        onGenerateDocsUpdates={(path) => console.log('Generate updates:', path)}
      />
    </div>
  );
}
