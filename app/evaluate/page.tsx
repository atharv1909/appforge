'use client';

import { useState } from 'react';
import type { EvaluationResult } from '@/lib/evaluation-data';

export default function EvaluatePage() {
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');

  const runEvaluation = async () => {
    setRunning(true);
    setProgress('Running 20 prompts through pipeline... this takes 3-5 minutes');
    try {
      const res = await fetch('/api/evaluate');
      const data = await res.json();
      setResults(data.results);
      setProgress('Done!');
    } catch (err: any) {
      setProgress(`Error: ${err.message}`);
    }
    setRunning(false);
  };

  const successCount = results.filter(r => r.success).length;
  const avgLatency = results.length > 0
    ? Math.round(results.reduce((a, b) => a + b.latency_ms, 0) / results.length / 1000)
    : 0;
  const repairCount = results.filter(r => r.repair_triggered).length;
  const clarCount = results.filter(r => r.clarification_triggered).length;

  return (
    <main style={{
      background: '#0a0a0f',
      minHeight: '100vh',
      color: '#f1f5f9',
      fontFamily: 'system-ui, sans-serif',
      padding: '32px',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="/" style={{ color: '#475569', textDecoration: 'none', fontSize: '14px' }}>← Back</a>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#818cf8' }}>
            🧪 Evaluation Framework
          </h1>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={runEvaluation}
            disabled={running}
            style={{
              background: running ? '#2a2a3a' : '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            {running ? '⟳ Running 20 prompts...' : '▶ Run Full Evaluation (20 prompts)'}
          </button>
          {progress && (
            <span style={{ marginLeft: '16px', color: '#94a3b8', fontSize: '13px' }}>
              {progress}
            </span>
          )}
        </div>

        {results.length > 0 && (
          <>
            {/* Summary Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '24px',
            }}>
              {[
                { label: 'Success Rate', value: `${Math.round((successCount / results.length) * 100)}%`, color: '#22c55e' },
                { label: 'Avg Latency', value: `${avgLatency}s`, color: '#818cf8' },
                { label: 'Repair Triggered', value: repairCount, color: '#f59e0b' },
                { label: 'Clarifications', value: clarCount, color: '#6366f1' },
              ].map(m => (
                <div key={m.label} style={{
                  background: '#12121a',
                  border: '1px solid #2a2a3a',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                }}>
                  <div style={{ color: m.color, fontSize: '28px', fontWeight: 700 }}>{m.value}</div>
                  <div style={{ color: '#475569', fontSize: '12px', marginTop: '4px' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Results Table */}
            <div style={{
              background: '#12121a',
              border: '1px solid #2a2a3a',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a3a' }}>
                    {['ID', 'Type', 'Status', 'Latency', 'Repairs', 'Errors Found', 'Assumptions', 'Conflicts'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        color: '#475569',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.prompt_id} style={{
                      borderBottom: '1px solid #1a1a25',
                      background: i % 2 === 0 ? 'transparent' : '#0d0d15',
                    }}>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#818cf8' }}>{r.prompt_id}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#94a3b8' }}>{r.prompt_type}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background:
                            r.status === 'success' ? '#14532d' :
                            r.status === 'clarification' ? '#1e3a5f' :
                            r.status === 'partial' ? '#451a03' : '#3b0000',
                          color:
                            r.status === 'success' ? '#22c55e' :
                            r.status === 'clarification' ? '#60a5fa' :
                            r.status === 'partial' ? '#f97316' : '#ef4444',
                        }}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#94a3b8' }}>
                        {(r.latency_ms / 1000).toFixed(1)}s
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: r.repair_triggered ? '#f59e0b' : '#475569' }}>
                        {r.repair_triggered ? `✓ ${r.repairs_succeeded}` : '−'}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#94a3b8' }}>
                        {r.validation_errors_found}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#94a3b8' }}>
                        {r.assumptions_made}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: r.conflicts_detected > 0 ? '#f59e0b' : '#94a3b8' }}>
                        {r.conflicts_detected}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}