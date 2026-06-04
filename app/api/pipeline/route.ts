import { NextRequest } from 'next/server';
import { callGemini } from '@/lib/gemini';
import { STAGE1_PROMPT, STAGE2_PROMPT, STAGE3_PROMPT } from '@/lib/prompts';
import { IntentSchema, DesignSchema, SchemaOutputSchema } from '@/lib/schemas';
import { runValidation } from '@/lib/validator';
import { repairSchema } from '@/lib/repairer';
import { generateRuntime, generateERD } from '@/lib/runtime-generator';
import { v4 as uuidv4 } from 'uuid';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { prompt, mode = 'balanced' } = await req.json();

const modeConfig = {
  fast:     { temperature: 0.3, maxTokens: 2048, description: 'Fast mode — fewer details, ~8s' },
  balanced: { temperature: 0.2, maxTokens: 4096, description: 'Balanced mode — default, ~15s' },
  deep:     { temperature: 0.1, maxTokens: 8192, description: 'Deep mode — max detail, ~25s' },
};
const config = modeConfig[mode as keyof typeof modeConfig];

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const emit = (data: object) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const startTime = Date.now();
  const stageLatencies: Record<string, number> = {};
  const pipelineId = uuidv4();

  (async () => {
    try {
      // ── STAGE 1: INTENT ──
      emit({ stage: 'intent', status: 'running' });
      const s1Start = Date.now();
      const intentRaw = await callGemini(STAGE1_PROMPT(prompt), 2, config.temperature, config.maxTokens);
      const intentParsed = JSON.parse(intentRaw);
      const intent = IntentSchema.parse(intentParsed);
      stageLatencies['intent'] = Date.now() - s1Start;
      emit({ stage: 'intent', status: 'done', data: intent });

      // Check if clarification needed
      if (intent.clarifications_needed.length > 0 && intent.entities.length < 2) {
        emit({
          stage: 'clarification',
          status: 'needed',
          questions: intent.clarifications_needed,
        });
        await writer.close();
        return;
      }

      // ── STAGE 2: DESIGN ──
      emit({ stage: 'design', status: 'running' });
      const s2Start = Date.now();
      const designRaw = await callGemini(STAGE2_PROMPT(intent), 2, config.temperature, config.maxTokens);
      const design = DesignSchema.parse(JSON.parse(designRaw));
      stageLatencies['design'] = Date.now() - s2Start;
      emit({ stage: 'design', status: 'done', data: design });

      // ── STAGE 3: SCHEMA ──
      emit({ stage: 'schema', status: 'running' });
      const s3Start = Date.now();
      const schemaRaw = await callGemini(STAGE3_PROMPT(intent, design), 2, config.temperature, config.maxTokens);
      let schema = SchemaOutputSchema.parse(JSON.parse(schemaRaw));
      stageLatencies['schema'] = Date.now() - s3Start;
      emit({ stage: 'schema', status: 'done', data: schema });

      // ── STAGE 4: VALIDATION ──
      emit({ stage: 'validate', status: 'running' });
      const s4Start = Date.now();
      const validationReport = runValidation(intent, design, schema);
      stageLatencies['validate'] = Date.now() - s4Start;
      emit({ stage: 'validate', status: 'done', data: validationReport });

      // ── STAGE 5: REPAIR ──
      let repairStats = { triggered: false, repaired: 0, failed: 0, attempts: 0 };

      if (!validationReport.passed) {
        emit({ stage: 'repair', status: 'running', error_count: validationReport.errors.length });
        const s5Start = Date.now();

        for (let attempt = 0; attempt < 2; attempt++) {
          repairStats.attempts++;
          const result = await repairSchema(schema, validationReport.errors);
          schema = result.schema;
          repairStats.triggered = true;
          repairStats.repaired += result.repaired;
          repairStats.failed += result.failed;

          const recheck = runValidation(intent, design, schema);
          if (recheck.passed) break;
        }

        stageLatencies['repair'] = Date.now() - s5Start;
        emit({ stage: 'repair', status: 'done', stats: repairStats });
      } else {
        emit({ stage: 'repair', status: 'skipped' });
      }

      // ── STAGE 6: RUNTIME ──
      emit({ stage: 'runtime', status: 'running' });
      const s6Start = Date.now();
      const runtime = generateRuntime(schema);
const erd = generateERD(schema);
      stageLatencies['runtime'] = Date.now() - s6Start;
      emit({ stage: 'runtime', status: 'done', data: runtime });

      // ── FINAL OUTPUT ──
      const finalOutput = {
        pipeline_id: pipelineId,
        timestamp: new Date().toISOString(),
        input_prompt: prompt,
        stages: { intent, design, schema },
        validation: {
          passed: repairStats.failed === 0,
          checks_run: validationReport.checks_run,
          checks_passed: validationReport.checks_passed,
          errors_found: validationReport.errors.length,
          errors_repaired: repairStats.repaired,
          errors_unresolved: repairStats.failed,
          repair_attempts: repairStats.attempts,
        },
        runtime,
erd,
        metrics: {
          total_latency_ms: Date.now() - startTime,
          stage_latencies: stageLatencies,
          ai_calls_made: 3,
mode: mode,
mode_description: config.description,
          repair_triggered: repairStats.triggered,
          repair_attempts: repairStats.attempts,
          tokens_used_estimate: Math.round((prompt.length + 8000) / 4),
        },
        assumptions: intent.assumptions,
        warnings: validationReport.warnings,
        status: repairStats.failed > 0 ? 'partial' : 'success',
      };

      emit({ stage: 'complete', status: 'done', output: finalOutput });

    } catch (error: any) {
      emit({ stage: 'error', message: error.message, stack: error.stack });
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
