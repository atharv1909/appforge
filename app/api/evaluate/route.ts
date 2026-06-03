import { NextRequest, NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini';
import { STAGE1_PROMPT, STAGE2_PROMPT, STAGE3_PROMPT } from '@/lib/prompts';
import { IntentSchema, DesignSchema, SchemaOutputSchema } from '@/lib/schemas';
import { runValidation } from '@/lib/validator';
import { repairSchema } from '@/lib/repairer';
import { REAL_PROMPTS, EDGE_PROMPTS } from '@/lib/evaluation-data';
import type { EvaluationResult } from '@/lib/evaluation-data';

async function runSingleEval(
  id: string,
  prompt: string,
  type: 'real' | 'edge'
): Promise<EvaluationResult> {
  const start = Date.now();

  try {
    // Stage 1
    const intentRaw = await callGemini(STAGE1_PROMPT(prompt));
    const intent = IntentSchema.parse(JSON.parse(intentRaw));

    // Clarification check
    if (intent.clarifications_needed.length > 0 && intent.entities.length < 2) {
      return {
        prompt_id: id,
        prompt,
        prompt_type: type,
        success: true,
        status: 'clarification',
        clarification_triggered: true,
        repair_triggered: false,
        repair_attempts: 0,
        repairs_succeeded: 0,
        validation_errors_found: 0,
        latency_ms: Date.now() - start,
        ai_calls_made: 1,
        assumptions_made: intent.assumptions.length,
        conflicts_detected: intent.conflicts.length,
        failure_reason: null,
      };
    }

    // Stage 2
    const designRaw = await callGemini(STAGE2_PROMPT(intent));
    const design = DesignSchema.parse(JSON.parse(designRaw));

    // Stage 3
    const schemaRaw = await callGemini(STAGE3_PROMPT(intent, design));
    let schema = SchemaOutputSchema.parse(JSON.parse(schemaRaw));

    // Stage 4
    const validation = runValidation(intent, design, schema);

    // Stage 5
    let repairTriggered = false;
    let repairAttempts = 0;
    let repairsSucceeded = 0;

    if (!validation.passed) {
      repairTriggered = true;
      for (let attempt = 0; attempt < 2; attempt++) {
        repairAttempts++;
        const result = await repairSchema(schema, validation.errors);
        schema = result.schema;
        repairsSucceeded += result.repaired;
        const recheck = runValidation(intent, design, schema);
        if (recheck.passed) break;
      }
    }

    return {
      prompt_id: id,
      prompt,
      prompt_type: type,
      success: true,
      status: 'success',
      clarification_triggered: false,
      repair_triggered: repairTriggered,
      repair_attempts: repairAttempts,
      repairs_succeeded: repairsSucceeded,
      validation_errors_found: validation.errors.length,
      latency_ms: Date.now() - start,
      ai_calls_made: 3,
      assumptions_made: intent.assumptions.length,
      conflicts_detected: intent.conflicts.length,
      failure_reason: null,
    };

  } catch (err: any) {
    return {
      prompt_id: id,
      prompt,
      prompt_type: type,
      success: false,
      status: 'failed',
      clarification_triggered: false,
      repair_triggered: false,
      repair_attempts: 0,
      repairs_succeeded: 0,
      validation_errors_found: 0,
      latency_ms: Date.now() - start,
      ai_calls_made: 0,
      assumptions_made: 0,
      conflicts_detected: 0,
      failure_reason: err.message,
    };
  }
}

export async function GET(req: NextRequest) {
  const results: EvaluationResult[] = [];

  for (const p of REAL_PROMPTS) {
    const result = await runSingleEval(p.id, p.prompt, 'real');
    results.push(result);
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 5000));
  }

  for (const p of EDGE_PROMPTS) {
    const result = await runSingleEval(p.id, p.prompt, 'edge');
    results.push(result);
    await new Promise(r => setTimeout(r, 5000));
  }

  return NextResponse.json({ results });
}
