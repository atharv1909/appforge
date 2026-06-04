'use client';

import { useState, useRef } from 'react';

interface StageStatus {
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  data?: any;
}

interface PipelineState {
  intent: StageStatus;
  design: StageStatus;
  schema: StageStatus;
  validate: StageStatus;
  repair: StageStatus;
  runtime: StageStatus;
}

const defaultPipeline: PipelineState = {
  intent: { status: 'pending' },
  design: { status: 'pending' },
  schema: { status: 'pending' },
  validate: { status: 'pending' },
  repair: { status: 'pending' },
  runtime: { status: 'pending' },
};

const STAGE_META: Record<string, { label: string; icon: string; desc: string }> = {
  intent:   { label: 'Intent',   icon: '🧠', desc: 'Parse user intent' },
  design:   { label: 'Design',   icon: '🏗️', desc: 'System architecture' },
  schema:   { label: 'Schema',   icon: '📐', desc: 'Generate all schemas' },
  validate: { label: 'Validate', icon: '✅', desc: 'Cross-layer checks' },
  repair:   { label: 'Repair',   icon: '🔧', desc: 'Fix inconsistencies' },
  runtime:  { label: 'Runtime',  icon: '⚙️', desc: 'Generate code stubs' },
};

type Mode = 'fast' | 'balanced' | 'deep';

const MODE_INFO: Record<Mode, { label: string; desc: string; latency: string; color: string }> = {
  fast:     { label: 'Fast',     desc: 'Less detail',    latency: '~8s',  color: '#22c55e' },
  balanced: { label: 'Balanced', desc: 'Default',        latency: '~15s', color: '#6366f1' },
  deep:     { label: 'Deep',     desc: 'Max detail',     latency: '~25s', color: '#f59e0b' },
};

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<Mode>('balanced');
  const [running, setRunning] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineState>(defaultPipeline);
  const [finalOutput, setFinalOutput] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'ui' | 'api' | 'db' | 'auth'>('ui');
  const [codeTab, setCodeTab] = useState<'react' | 'express' | 'sql'>('react');
  const [statusMsg, setStatusMsg] = useState('');
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const updateStage = (stage: string, update: Partial<StageStatus>) => {
    setPipeline(prev => ({
      ...prev,
      [stage]: { ...prev[stage as keyof PipelineState], ...update },
    }));
  };

  const runPipeline = async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setFinalOutput(null);
    setClarifications([]);
    setPipeline(defaultPipeline);
    setStatusMsg('Initializing pipeline...');

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.replace('data: ', ''));

            if (data.stage === 'clarification') {
              setClarifications(data.questions);
              setStatusMsg('⚠️ Input too vague — clarification needed');
              setRunning(false);
              return;
            }

            if (data.stage === 'complete') {
              setFinalOutput(data.output);
              setStatusMsg('✅ Pipeline complete');
              setRunning(false);
              return;
            }

            if (data.stage === 'error') {
              setStatusMsg(`❌ ${data.message}`);
              setRunning(false);
              return;
            }

            if (data.stage in pipeline) {
              updateStage(data.stage, { status: data.status, data: data.data || data.stats });
              if (data.status === 'running') setStatusMsg(`Running: ${STAGE_META[data.stage]?.label}...`);
              if (data.status === 'done') setStatusMsg(`✓ ${STAGE_META[data.stage]?.label} complete`);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setStatusMsg(`❌ ${err.message}`);
      setRunning(false);
    }
  };

  const copyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: StageStatus['status']) => {
    switch (status) {
      case 'done':    return '#22c55e';
      case 'running': return '#818cf8';
      case 'error':   return '#ef4444';
      case 'skipped': return '#475569';
      default:        return '#2a2a3a';
    }
  };

  const schemaData = finalOutput ? {
    ui:   finalOutput.stages.schema.ui_schema,
    api:  finalOutput.stages.schema.api_schema,
    db:   finalOutput.stages.schema.db_schema,
    auth: finalOutput.stages.schema.auth_rules,
  } : null;

  return (
    <main style={{ background: '#080810', minHeight: '100vh', color: '#f1f5f9', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🔧</span>
          <span style={{ fontWeight: 700, fontSize: '18px', color: '#818cf8', letterSpacing: '-0.5px' }}>AppForge</span>
          <span style={{
            background: '#1e1e3a',
            color: '#6366f1',
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '99px',
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}>COMPILER</span>
        </div>
        <span style={{ color: '#2a2a3a' }}>|</span>
        <span style={{ color: '#475569', fontSize: '13px' }}>Natural Language → App Architecture</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <a href="/evaluate" style={{
            color: '#475569',
            fontSize: '13px',
            textDecoration: 'none',
            padding: '6px 14px',
            border: '1px solid #2a2a3a',
            borderRadius: '6px',
            transition: 'all 0.2s',
          }}>🧪 Eval Dashboard</a>
        </div>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{
            fontSize: '42px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #4f46e5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px',
            letterSpacing: '-1px',
          }}>
            AI App Compiler
          </h1>
          <p style={{ color: '#475569', fontSize: '16px', maxWidth: '500px', margin: '0 auto' }}>
            Describe any app in plain English. Get a complete, validated, executable architecture in seconds.
          </p>
        </div>

        {/* Input Card */}
        <div style={{
          background: '#0e0e1a',
          border: '1px solid #1e1e2e',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 0 40px rgba(99,102,241,0.05)',
        }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe your app... e.g. 'Build a CRM with login, contacts, dashboard, role-based access for admin and sales reps, and Stripe payments'"
            rows={4}
            style={{
              width: '100%',
              background: '#080810',
              border: '1px solid #1e1e2e',
              borderRadius: '10px',
              color: '#f1f5f9',
              padding: '16px',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              lineHeight: '1.6',
              fontFamily: 'inherit',
            }}
          />

          {/* Mode selector + button row */}
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Mode buttons */}
            <div style={{ display: 'flex', gap: '6px', background: '#080810', padding: '4px', borderRadius: '8px', border: '1px solid #1e1e2e' }}>
              {(Object.keys(MODE_INFO) as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: mode === m ? '#1e1e3a' : 'transparent',
                    color: mode === m ? MODE_INFO[m].color : '#475569',
                    fontSize: '13px',
                    fontWeight: mode === m ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {MODE_INFO[m].label}
                  <span style={{ fontSize: '11px', marginLeft: '6px', opacity: 0.7 }}>
                    {MODE_INFO[m].latency}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ color: '#2a2a3a', fontSize: '12px' }}>
              {MODE_INFO[mode].desc} · temperature {mode === 'fast' ? '0.3' : mode === 'balanced' ? '0.2' : '0.1'} · max tokens {mode === 'fast' ? '2,048' : mode === 'balanced' ? '4,096' : '8,192'}
            </div>

            <button
              onClick={runPipeline}
              disabled={running || !prompt.trim()}
              style={{
                marginLeft: 'auto',
                background: running ? '#1e1e2e' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: running ? '#475569' : '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: running ? 'not-allowed' : 'pointer',
                boxShadow: running ? 'none' : '0 4px 20px rgba(99,102,241,0.3)',
                transition: 'all 0.2s',
              }}
            >
              {running ? '⟳ Compiling...' : '⚡ Generate App Schema'}
            </button>
          </div>

          {statusMsg && (
            <div style={{ marginTop: '12px', color: '#475569', fontSize: '13px' }}>
              {statusMsg}
            </div>
          )}
        </div>

        {/* Clarification */}
        {clarifications.length > 0 && (
          <div style={{
            background: '#120f00',
            border: '1px solid #f59e0b',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px',
          }}>
            <div style={{ color: '#f59e0b', fontWeight: 600, marginBottom: '12px', fontSize: '14px' }}>
              ⚠️ Your input is too vague. Please add these details:
            </div>
            {clarifications.map((q, i) => (
              <div key={i} style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '6px', paddingLeft: '12px' }}>
                {i + 1}. {q}
              </div>
            ))}
          </div>
        )}

        {/* Pipeline Stages */}
        <div style={{
          background: '#0e0e1a',
          border: '1px solid #1e1e2e',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <div style={{ color: '#2a2a4a', fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', marginBottom: '20px', textTransform: 'uppercase' }}>
            Compilation Pipeline
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
            {Object.entries(pipeline).map(([stage, state], idx) => {
              const meta = STAGE_META[stage];
              const color = getStatusColor(state.status);
              return (
                <div key={stage} style={{
                  background: '#080810',
                  border: `1px solid ${state.status === 'pending' ? '#1e1e2e' : color}`,
                  borderRadius: '10px',
                  padding: '14px 10px',
                  textAlign: 'center',
                  transition: 'all 0.3s',
                  boxShadow: state.status === 'running' ? `0 0 20px ${color}33` : 'none',
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>{meta.icon}</div>
                  <div style={{ color: color, fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
                    {meta.label}
                  </div>
                  <div style={{ color: '#2a2a4a', fontSize: '10px' }}>{meta.desc}</div>
                  <div style={{ marginTop: '8px', fontSize: '10px', color: color, fontWeight: 600 }}>
                    {state.status === 'running' ? '⟳' : state.status === 'done' ? '✓' : state.status === 'skipped' ? '−' : state.status === 'error' ? '✗' : '·'}
                    {' '}{state.status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Output */}
        {finalOutput && (
          <>
            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Total Latency',  value: `${(finalOutput.metrics.total_latency_ms / 1000).toFixed(1)}s`, icon: '⏱' },
                { label: 'Mode',           value: finalOutput.metrics.mode?.toUpperCase() || mode.toUpperCase(), icon: '⚡' },
                { label: 'AI Calls',       value: finalOutput.metrics.ai_calls_made, icon: '🤖' },
                { label: 'Repairs Made',   value: finalOutput.validation.errors_repaired, icon: '🔧' },
                { label: 'Status',         value: finalOutput.status.toUpperCase(), icon: finalOutput.status === 'success' ? '✅' : '⚠️' },
              ].map(m => (
                <div key={m.label} style={{
                  background: '#0e0e1a',
                  border: '1px solid #1e1e2e',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>{m.icon}</div>
                  <div style={{ color: '#818cf8', fontSize: '18px', fontWeight: 700 }}>{m.value}</div>
                  <div style={{ color: '#2a2a4a', fontSize: '11px', marginTop: '4px' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Cost vs Quality analysis */}
            <div style={{
              background: '#0e0e1a',
              border: '1px solid #1e1e2e',
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '24px',
            }}>
              <div style={{ color: '#2a2a4a', fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', marginBottom: '16px', textTransform: 'uppercase' }}>
                Cost vs Quality Analysis
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {(Object.keys(MODE_INFO) as Mode[]).map(m => (
                  <div key={m} style={{
                    background: '#080810',
                    border: `1px solid ${m === mode ? MODE_INFO[m].color : '#1e1e2e'}`,
                    borderRadius: '8px',
                    padding: '14px',
                  }}>
                    <div style={{ color: MODE_INFO[m].color, fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                      {m === mode ? '▶ ' : ''}{MODE_INFO[m].label} Mode
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {[
                        { k: 'Latency',     v: MODE_INFO[m].latency },
                        { k: 'Temperature', v: m === 'fast' ? '0.3 (more creative)' : m === 'balanced' ? '0.2 (default)' : '0.1 (deterministic)' },
                        { k: 'Max Tokens',  v: m === 'fast' ? '2,048' : m === 'balanced' ? '4,096' : '8,192' },
                        { k: 'Cost',        v: '$0.00 (Groq free tier)' },
                        { k: 'Best for',    v: m === 'fast' ? 'Quick prototypes' : m === 'balanced' ? 'Most use cases' : 'Complex apps' },
                      ].map(row => (
                        <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: '#475569' }}>{row.k}</span>
                          <span style={{ color: '#94a3b8' }}>{row.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assumptions */}
            {finalOutput.assumptions.length > 0 && (
              <div style={{
                background: '#0e0e1a',
                border: '1px solid #1e1e2e',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '24px',
              }}>
                <div style={{ color: '#2a2a4a', fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', marginBottom: '12px', textTransform: 'uppercase' }}>
                  Assumptions Made ({finalOutput.assumptions.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {finalOutput.assumptions.map((a: string, i: number) => (
                    <div key={i} style={{
                      background: '#080810',
                      border: '1px solid #1e1e2e',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: '#94a3b8',
                    }}>
                      <span style={{ color: '#6366f1', marginRight: '8px' }}>→</span>{a}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {finalOutput.warnings?.length > 0 && (
              <div style={{
                background: '#0f0a00',
                border: '1px solid #f59e0b33',
                borderRadius: '12px',
                padding: '16px 24px',
                marginBottom: '24px',
              }}>
                <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                  ⚠️ Warnings ({finalOutput.warnings.length})
                </div>
                {finalOutput.warnings.map((w: string, i: number) => (
                  <div key={i} style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>• {w}</div>
                ))}
              </div>
            )}

            {/* Schema Tabs */}
            <div style={{
              background: '#0e0e1a',
              border: '1px solid #1e1e2e',
              borderRadius: '16px',
              overflow: 'hidden',
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e', background: '#080810' }}>
                {(['ui', 'api', 'db', 'auth'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: '14px 24px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
                    color: activeTab === tab ? '#f1f5f9' : '#475569',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: activeTab === tab ? 600 : 400,
                  }}>
                    {tab === 'ui' ? '🖥 UI Schema' : tab === 'api' ? '🔌 API Schema' : tab === 'db' ? '🗄 DB Schema' : '🔐 Auth Rules'}
                  </button>
                ))}
                <button onClick={() => copyJson(schemaData![activeTab])} style={{
                  marginLeft: 'auto',
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: copied ? '#22c55e' : '#475569',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginRight: '8px',
                }}>
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>
              <pre style={{
                margin: 0,
                padding: '24px',
                overflow: 'auto',
                maxHeight: '450px',
                fontSize: '12px',
                color: '#94a3b8',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                lineHeight: '1.6',
              }}>
                {JSON.stringify(schemaData![activeTab], null, 2)}
              </pre>
            </div>

            {/* ERD Diagram */}
<div style={{
  background: '#0e0e1a',
  border: '1px solid #1e1e2e',
  borderRadius: '16px',
  overflow: 'hidden',
  marginBottom: '24px',
}}>
  <div style={{
    padding: '14px 24px',
    borderBottom: '1px solid #1e1e2e',
    background: '#080810',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }}>
    <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
      Entity Relationship Diagram
    </div>
    <div style={{ fontSize: '12px', color: '#2a2a4a' }}>
      {finalOutput.stages.schema.db_schema.tables.length} tables · auto-generated from DB schema
    </div>
  </div>
  <div style={{ padding: '20px' }}
    dangerouslySetInnerHTML={{ __html: finalOutput.erd }}
  />
</div>
            {/* Generated Code */}
            <div style={{
              background: '#0e0e1a',
              border: '1px solid #1e1e2e',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e', background: '#080810', alignItems: 'center' }}>
                <div style={{ padding: '14px 24px', color: '#2a2a4a', fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  Generated Code
                </div>
                {(['react', 'express', 'sql'] as const).map(tab => (
                  <button key={tab} onClick={() => setCodeTab(tab)} style={{
                    padding: '14px 20px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: codeTab === tab ? '2px solid #22c55e' : '2px solid transparent',
                    color: codeTab === tab ? '#f1f5f9' : '#475569',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: codeTab === tab ? 600 : 400,
                  }}>
                    {tab === 'react' ? '⚛️ React' : tab === 'express' ? '🚀 Express' : '🗄 SQL'}
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', padding: '0 20px', fontSize: '12px', color: finalOutput.runtime.execution_valid ? '#22c55e' : '#f59e0b' }}>
                  {finalOutput.runtime.execution_valid ? '✓ Execution Valid' : '⚠ Issues Found'}
                  <span style={{ color: '#2a2a4a', marginLeft: '8px' }}>
                    {finalOutput.runtime.cross_references_verified} refs verified
                  </span>
                </div>
              </div>
              <pre style={{
                margin: 0,
                padding: '24px',
                overflow: 'auto',
                maxHeight: '450px',
                fontSize: '12px',
                color: '#94a3b8',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                lineHeight: '1.6',
              }}>
                {codeTab === 'react'
                  ? finalOutput.runtime.react_components.map((c: any) => `// === ${c.name} ===\n${c.code}`).join('\n\n')
                  : codeTab === 'express'
                  ? finalOutput.runtime.express_routes
                  : finalOutput.runtime.db_migration}
              </pre>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
