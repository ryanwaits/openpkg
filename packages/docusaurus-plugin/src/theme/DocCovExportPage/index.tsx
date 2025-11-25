import CodeBlock from '@theme/CodeBlock';
import Layout from '@theme/Layout';
import React from 'react';

interface ExportData {
  id: string;
  name: string;
  kind: string;
  description?: string;
  examples?: string[];
  signatures?: Array<{
    parameters?: Array<{
      name: string;
      required?: boolean;
      description?: string;
      schema?: unknown;
    }>;
    returns?: {
      description?: string;
      schema?: unknown;
    };
    description?: string;
  }>;
  members?: Array<{
    name?: string;
    kind?: string;
    description?: string;
  }>;
  source?: {
    file?: string;
    line?: number;
  };
  deprecated?: boolean;
  docs?: {
    coverageScore?: number;
    missing?: string[];
    drift?: Array<{
      type: string;
      issue: string;
      suggestion?: string;
    }>;
  };
  tags?: Array<{
    name: string;
    text: string;
  }>;
}

interface Props {
  exportData: ExportData;
}

export default function DocCovExportPage({ exportData }: Props): JSX.Element {
  const { name, kind, description, examples, signatures, members, source, deprecated, docs, tags } =
    exportData;

  return (
    <Layout title={name} description={description}>
      <main style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Header */}
          <header style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h1 style={{ margin: 0 }}>{name}</h1>
              <span
                style={{
                  backgroundColor: getKindColor(kind),
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {kind}
              </span>
              {deprecated && (
                <span
                  style={{
                    backgroundColor: '#f44336',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                >
                  Deprecated
                </span>
              )}
            </div>

            {source && (
              <p style={{ color: '#666', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {source.file}
                {source.line && `:${source.line}`}
              </p>
            )}
          </header>

          {/* Coverage warning */}
          {docs?.drift && docs.drift.length > 0 && (
            <div
              style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '2rem',
              }}
            >
              <strong>⚠️ Documentation Drift Detected</strong>
              <ul style={{ marginBottom: 0, marginTop: '0.5rem' }}>
                {docs.drift.map((d, i) => (
                  <li key={i}>
                    {d.issue}
                    {d.suggestion && <em> — {d.suggestion}</em>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          {description && (
            <section style={{ marginBottom: '2rem' }}>
              <p style={{ fontSize: '1.125rem', lineHeight: 1.6 }}>{description}</p>
            </section>
          )}

          {/* Signatures */}
          {signatures && signatures.length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              <h2>Signature</h2>
              {signatures.map((sig, i) => (
                <div key={i} style={{ marginBottom: '1rem' }}>
                  {sig.parameters && sig.parameters.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h3>Parameters</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Name</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sig.parameters.map((param, j) => (
                            <tr key={j} style={{ borderBottom: '1px solid #e0e0e0' }}>
                              <td style={{ padding: '0.5rem' }}>
                                <code>{param.name}</code>
                                {param.required === false && (
                                  <span style={{ color: '#666' }}> (optional)</span>
                                )}
                              </td>
                              <td style={{ padding: '0.5rem' }}>
                                <code>{formatSchema(param.schema)}</code>
                              </td>
                              <td style={{ padding: '0.5rem' }}>{param.description ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {sig.returns && (
                    <div>
                      <h3>Returns</h3>
                      <p>
                        <code>{formatSchema(sig.returns.schema)}</code>
                        {sig.returns.description && ` — ${sig.returns.description}`}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Members */}
          {members && members.length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              <h2>Members</h2>
              {members.map((member, i) => (
                <div
                  key={i}
                  style={{
                    padding: '1rem',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    marginBottom: '0.5rem',
                  }}
                >
                  <strong>{member.name}</strong>
                  {member.kind && <span style={{ color: '#666' }}> ({member.kind})</span>}
                  {member.description && (
                    <p style={{ margin: '0.5rem 0 0' }}>{member.description}</p>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Examples */}
          {examples && examples.length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              <h2>Examples</h2>
              {examples.map((example, i) => (
                <CodeBlock key={i} language="typescript">
                  {example}
                </CodeBlock>
              ))}
            </section>
          )}

          {/* Tags */}
          {tags && tags.length > 0 && (
            <section>
              <h2>Tags</h2>
              {tags.map((tag, i) => (
                <div key={i} style={{ marginBottom: '0.5rem' }}>
                  <strong>@{tag.name}</strong>: {tag.text}
                </div>
              ))}
            </section>
          )}
        </div>
      </main>
    </Layout>
  );
}

function getKindColor(kind: string): string {
  const colors: Record<string, string> = {
    function: '#2196f3',
    class: '#9c27b0',
    interface: '#00bcd4',
    type: '#607d8b',
    variable: '#795548',
    enum: '#ff5722',
  };
  return colors[kind] ?? '#9e9e9e';
}

function formatSchema(schema: unknown): string {
  if (!schema) return 'unknown';
  if (typeof schema === 'string') return schema;
  if (typeof schema === 'object') {
    const obj = schema as Record<string, unknown>;
    if (obj.$ref && typeof obj.$ref === 'string') {
      return obj.$ref.replace('#/types/', '');
    }
    if (obj.type) return String(obj.type);
  }
  return JSON.stringify(schema);
}
