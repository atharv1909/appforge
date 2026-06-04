'use client';

import { useState } from 'react';
import { REAL_PROMPTS, EDGE_PROMPTS } from '@/lib/evaluation-data';
import type { EvaluationResult } from '@/lib/evaluation-data';

export default function EvaluatePage() {
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);

  const ALL_PROMPTS = [
    ...REAL_PROMPTS.map(p => ({ id: p.id, prompt: p.prompt, type: 'real' as const })),
    ...EDGE_PROMPTS.map(p => ({ id: p.id, prompt: p.prompt, type: 'edge' as const })),
  ];

  const runEvaluation = async () => {
    setRunning(true);
    setResults([]);
    setCurrentIdx(0);
    const allResults: EvaluationResult[] = [];

    for (let i = 0; i < ALL_PROMPTS.length; i++) {
      const p = ALL_PROMPTS[i];
      setCurrentIdx(i + 1);
      setProgress(`Running ${i + 1} of ${ALL_PROMPTS.length}: ${p.id}...`);

      try {
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id, prompt: p.prompt, type: p.type }),
        });
        const data = await res.json();
        allResults.push(data);
        setResults([...allResults]);
      } catch (err: any) {
        allResults.push({
          prompt_id: p.id,
          prompt: p.prompt,
          prompt_type: p.type,
          success: false,
          status: 'failed',
          clarification_triggered: false,
          repair_triggered: false,
          repair_attempts: 0,
          repairs_succeeded: 0,
          validation_errors_found: 0,
          latency_ms: 0,
          ai_calls_made: 0,
          assumptions_made: 0,
          conflicts_detected: 0,
          failure_reason: err.message,
        });
        setResults([...allResults]);
      }

      // 3s delay between prompts to respect rate limits
      if (i < ALL_PROMPTS.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setProgress('Evaluation complete.');
    setRunning(false);
  };

  const successCount = results.filter(r => r.success).length;
  const avgLatency = results.length > 0
    ? (results.reduce((a, b) => a + b.latency_ms, 0) / results.length / 1000).toFixed(1)
    : '—';
  const repairCount = results.filter(r => r.repair_triggered).length;
  const clarCount = results.filter(r => r.clarification_triggered).length;
  const successRate = results.length > 0 ? Math.round((successCount / results.length) * 100) : 0;

  return (
    <main style={{
      background: '#080810',
      minHeight: '100vh',
      color: '#f1f5f9',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <header style={{
        borderBottom: '1px solid #1e1e2e',
        padding: '0 32px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: '#0a0a14',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <a href="/" style={{ color: '#475569', textDecoration: 'none', fontSize: '13px' }}>
          ← Back to AppForge
        </a>
        <span style={{ color: '#1e1e2e' }}>|</span>
        <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px' }}>Evaluation Framework</span>
        <span style={{
          background: '#1e1e3a',
          color: '#6366f1',
          fontSize: '10px',
          padding: '2px 8px',
          borderRadius: '99px',
          fontWeight: 600,
          letterSpacing: '0.5px',
        }}>20 PROMPTS</span>
      </header>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            Pipeline Evaluation Suite
          </h1>
          <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', maxWidth: '680px' }}>
            Runs 20 prompts — 10 real-world product descriptions and 10 edge cases (vague, conflicting, incomplete) —
            through the full 6-stage pipeline and tracks success rate, repair behavior, latency, and failure types.
          </p>
        </div>

        <div style={{
          background: '#0e0e1a',
          border: '1px solid #1e1e2e',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={runEvaluation}
            disabled={running}
            style={{
              background: running ? '#1e1e2e' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: running ? '#475569' : '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '11px 24px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: running ? 'not-allowed' : 'pointer',
              boxShadow: running ? 'none' : '0 4px 20px rgba(99,102,241,0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            {running ? `Running ${currentIdx} of 20...` : 'Run Full Evaluation'}
          </button>

          <div style={{
            flex: 1,
            background: '#080810',
            border: '1px solid #1e1e2e',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '12px',
            color: '#475569',
            lineHeight: '1.6',
          }}>
            <span style={{ color: '#94a3b8', fontWeight: 500 }}>Note: </span>
            Each prompt runs as an independent API call with a 3-second interval to respect rate limits.
            Total runtime is approximately 8–12 minutes. Results may vary between runs as the system
            uses the Groq inference API (free tier), which is subject to rate limits and model non-determinism.
          </div>

          {progress && (
            <span style={{ color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>
              {progress}
            </span>
          )}
        </div>

        {/* Progress bar while running */}
        {running && (
          <div style={{
            background: '#0e0e1a',
            border: '1px solid #1e1e2e',
            borderRadius: '8px',
            padding: '4px',
            marginBottom: '24px',
          }}>
            <div style={{
              background: 'linear-gradient(90deg, #6366f1, #4f46e5)',
              height: '4px',
              borderRadius: '4px',
              width: `${(currentIdx / 20) * 100}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        )}

        {results.length > 0 && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '32px',
            }}>
              {[
                { label: 'Success Rate',     value: `${successRate}%`,  sub: `${successCount} of ${results.length} passed` },
                { label: 'Avg Latency',      value: `${avgLatency}s`,   sub: 'per prompt end-to-end' },
                { label: 'Repair Triggered', value: repairCount,         sub: 'auto-repaired schemas' },
                { label: 'Clarifications',   value: clarCount,           sub: 'vague inputs detected' },
              ].map(m => (
                <div key={m.label} style={{
                  background: '#0e0e1a',
                  border: '1px solid #1e1e2e',
                  borderRadius: '12px',
                  padding: '20px',
                }}>
                  <div style={{ color: '#818cf8', fontSize: '30px', fontWeight: 700, letterSpacing: '-1px' }}>
                    {m.value}
                  </div>
                  <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500, margin: '6px 0 4px' }}>
                    {m.label}
                  </div>
                  <div style={{ color: '#2a2a4a', fontSize: '11px' }}>{m.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Real Prompts', items: results.filter(r => r.prompt_type === 'real') },
                { label: 'Edge Cases',   items: results.filter(r => r.prompt_type === 'edge') },
              ].map(cat => {
                const catSuccess = cat.items.filter(r => r.success).length;
                const catRate = cat.items.length > 0 ? Math.round((catSuccess / cat.items.length) * 100) : 0;
                return (
                  <div key={cat.label} style={{
                    background: '#0e0e1a',
                    border: '1px solid #1e1e2e',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 500 }}>{cat.label}</div>
                      <div style={{ color: '#475569', fontSize: '12px', marginTop: '4px' }}>
                        {catSuccess} of {cat.items.length} succeeded
                      </div>
                    </div>
                    <div style={{
                      color: catRate >= 70 ? '#22c55e' : catRate >= 40 ? '#f59e0b' : '#ef4444',
                      fontSize: '28px',
                      fontWeight: 700,
                    }}>
                      {catRate}%
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              background: '#0e0e1a',
              border: '1px solid #1e1e2e',
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #1e1e2e',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Detailed Results</span>
                <span style={{ color: '#2a2a4a', fontSize: '12px' }}>{results.length} prompts evaluated</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#080810' }}>
                      {['ID', 'Category', 'Status', 'Latency', 'Errors Found', 'Repaired', 'Assumptions', 'Conflicts', 'Failure Reason'].map(h => (
                        <th key={h} style={{
                          padding: '10px 16px',
                          textAlign: 'left',
                          color: '#2a2a4a',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid #1e1e2e',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.prompt_id} style={{
                        borderBottom: '1px solid #0d0d18',
                        background: i % 2 === 0 ? 'transparent' : '#0a0a12',
                      }}>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#6366f1', fontWeight: 600 }}>
                          {r.prompt_id}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {r.prompt_type}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background:
                              r.status === 'success'       ? '#0d2818' :
                              r.status === 'clarification' ? '#0d1a2e' :
                              r.status === 'partial'       ? '#1a0e00' : '#1a0000',
                            color:
                              r.status === 'success'       ? '#22c55e' :
                              r.status === 'clarification' ? '#60a5fa' :
                              r.status === 'partial'       ? '#f97316' : '#ef4444',
                          }}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {(r.latency_ms / 1000).toFixed(1)}s
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: r.validation_errors_found > 0 ? '#f59e0b' : '#475569', fontFamily: 'monospace' }}>
                          {r.validation_errors_found}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: r.repair_triggered ? '#22c55e' : '#2a2a4a', fontFamily: 'monospace' }}>
                          {r.repair_triggered ? `+${r.repairs_succeeded}` : '—'}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
                          {r.assumptions_made || '—'}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: r.conflicts_detected > 0 ? '#f59e0b' : '#2a2a4a', fontFamily: 'monospace' }}>
                          {r.conflicts_detected || '—'}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '11px', color: '#ef4444', fontFamily: 'monospace', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
  {r.failure_reason || '—'}
</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
