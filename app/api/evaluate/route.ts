import { NextRequest, NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini';
import { STAGE1_PROMPT, STAGE2_PROMPT, STAGE3_PROMPT } from '@/lib/prompts';
import { IntentSchema, DesignSchema, SchemaOutputSchema } from '@/lib/schemas';
import { runValidation } from '@/lib/validator';
import { repairSchema } from '@/lib/repairer';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { id, prompt, type } = await req.json();
  const start = Date.now();

  try {
    const intentRaw = await callGemini(STAGE1_PROMPT(prompt));
    const intent = IntentSchema.parse(JSON.parse(intentRaw));

    if (intent.clarifications_needed.length > 0 && intent.entities.length < 2) {
      return NextResponse.json({
        prompt_id: id, prompt, prompt_type: type,
        success: true, status: 'clarification',
        clarification_triggered: true, repair_triggered: false,
        repair_attempts: 0, repairs_succeeded: 0,
        validation_errors_found: 0, latency_ms: Date.now() - start,
        ai_calls_made: 1, assumptions_made: intent.assumptions.length,
        conflicts_detected: intent.conflicts.length, failure_reason: null,
      });
    }

    const designRaw = await callGemini(STAGE2_PROMPT(intent));
    const design = DesignSchema.parse(JSON.parse(designRaw));

    const schemaRaw = await callGemini(STAGE3_PROMPT(intent, design));
    let schema = SchemaOutputSchema.parse(JSON.parse(schemaRaw));

    const validation = runValidation(intent, design, schema);

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

    return NextResponse.json({
      prompt_id: id, prompt, prompt_type: type,
      success: true, status: 'success',
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
    });

 } catch (err: any) {
    return NextResponse.json({
      prompt_id: id, prompt, prompt_type: type,
      success: false, status: 'failed',
      clarification_triggered: false, repair_triggered: false,
      repair_attempts: 0, repairs_succeeded: 0,
      validation_errors_found: 0, latency_ms: Date.now() - start,
      ai_calls_made: 0, assumptions_made: 0,
      conflicts_detected: 0, failure_reason: err.message,
    });
  }
}
