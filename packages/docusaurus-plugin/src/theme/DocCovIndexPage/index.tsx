import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

interface ExportListItem {
  id: string;
  name: string;
  kind: string;
  description?: string;
  coverage: number;
  hasDrift: boolean;
}

interface IndexData {
  meta: {
    name: string;
    version?: string;
    description?: string;
  };
  coverage: number;
  exportCount: number;
  typeCount: number;
  showCoverage: boolean;
  coverageThreshold: number;
}

interface Props {
  indexData: IndexData;
  exportsList: ExportListItem[];
}

function getCoverageColor(score: number, threshold: number): string {
  if (score >= threshold) return '#4caf50';
  if (score >= threshold * 0.75) return '#ff9800';
  return '#f44336';
}

function KindBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    function: '#2196f3',
    class: '#9c27b0',
    interface: '#00bcd4',
    type: '#607d8b',
    variable: '#795548',
    enum: '#ff5722',
  };

  return (
    <span
      style={{
        backgroundColor: colors[kind] ?? '#9e9e9e',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500,
        textTransform: 'uppercase',
      }}
    >
      {kind}
    </span>
  );
}

export default function DocCovIndexPage({ indexData, exportsList }: Props): JSX.Element {
  const { meta, coverage, exportCount, typeCount, showCoverage, coverageThreshold } = indexData;

  return (
    <Layout title={`${meta.name} API Reference`} description={meta.description}>
      <main style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <header style={{ marginBottom: '2rem' }}>
            <h1>{meta.name}</h1>
            {meta.version && (
              <span style={{ color: '#666', marginLeft: '0.5rem' }}>v{meta.version}</span>
            )}
            {meta.description && <p style={{ color: '#666' }}>{meta.description}</p>}

            {showCoverage && (
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <strong>Docs Coverage</strong>
                  <div
                    style={{
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      color: getCoverageColor(coverage, coverageThreshold),
                    }}
                  >
                    {coverage}%
                  </div>
                </div>
                <div>
                  <strong>Exports</strong>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{exportCount}</div>
                </div>
                <div>
                  <strong>Types</strong>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{typeCount}</div>
                </div>
              </div>
            )}
          </header>

          <section>
            <h2>Exports</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {exportsList.map((exp) => (
                <Link
                  key={exp.id}
                  to={`/api/${exp.id}`}
                  style={{
                    display: 'block',
                    padding: '1rem',
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <KindBadge kind={exp.kind} />
                    <strong>{exp.name}</strong>
                    {showCoverage && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          color: getCoverageColor(exp.coverage, coverageThreshold),
                          fontWeight: 500,
                        }}
                      >
                        {exp.coverage}%
                      </span>
                    )}
                    {exp.hasDrift && (
                      <span style={{ color: '#ff9800' }} title="Has documentation drift">
                        ⚠️
                      </span>
                    )}
                  </div>
                  {exp.description && (
                    <p style={{ color: '#666', marginTop: '0.5rem', marginBottom: 0 }}>
                      {exp.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
