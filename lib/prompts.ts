import type { IntentOutput, DesignOutput } from './schemas';

export const STAGE1_PROMPT = (userInput: string) => `
You are an intent extraction engine for an AI app compiler system.
Parse the following app description into structured JSON.

CRITICAL RULES:
- Output ONLY valid JSON. Zero markdown. Zero explanation. Zero backticks.
- Never hallucinate fields not in the schema below.
- Never omit required fields.
- If something is ambiguous, assume the most common interpretation and add to assumptions[].
- If there is a direct logical conflict, add it to conflicts[].

APP DESCRIPTION:
${userInput}

Output this exact JSON structure (fill ALL fields, no extras):
{
  "domain": "app category like CRM, E-commerce, HR Tool",
  "app_name": "suggested name",
  "features": ["list of all features"],
  "entities": ["list of all data entities/models"],
  "roles": ["list of all user roles"],
  "auth_required": true,
  "payment_required": false,
  "analytics_required": false,
  "assumptions": ["things you assumed"],
  "conflicts": ["contradictions found"],
  "clarifications_needed": ["questions if input too vague, else empty array"],
  "complexity": "simple"
}
`;

export const STAGE2_PROMPT = (intent: IntentOutput) => `
You are a software architect. Given this app intent, design the system architecture.

CRITICAL RULES:
- Output ONLY valid JSON. Zero markdown. Zero explanation. Zero backticks.
- accessible_by must only use roles from: ${JSON.stringify(intent.roles)}
- entity_relations must only reference entities from: ${JSON.stringify(intent.entities)}

APP INTENT:
${JSON.stringify(intent)}

Output this exact JSON structure:
{
  "pages": [
    {
      "name": "PageName",
      "path": "/path",
      "accessible_by": ["role"],
      "components": ["ComponentName"]
    }
  ],
  "flows": [
    {
      "name": "FlowName",
      "trigger": "what triggers it",
      "steps": ["step1", "step2"],
      "outcome": "result"
    }
  ],
  "auth_model": {
    "type": "RBAC",
    "roles": ${JSON.stringify(intent.roles)},
    "permissions": {}
  },
  "entity_relations": [
    {
      "from": "Entity1",
      "to": "Entity2",
      "type": "one-to-many",
      "field": "foreign_key_name"
    }
  ],
  "navigation": {
    "sidebar": ["Page1", "Page2"],
    "topbar": ["Profile", "Settings"]
  }
}
`;

export const STAGE3_PROMPT = (intent: IntentOutput, design: DesignOutput) => `
You are a schema generation engine. Generate all four schemas.

CONSISTENCY RULES (these will be validated — violations will be caught):
1. Every ui component's api_endpoint must be an id that exists in api_schema.endpoints
2. Every api endpoint's db_table must be a table name that exists in db_schema.tables
3. Every api endpoint request_body field must exist as a column in the referenced db_table
4. Every auth role name must be from: ${JSON.stringify(intent.roles)}
5. Every protected_route must be a path from ui_schema pages

APP INTENT: ${JSON.stringify(intent)}
SYSTEM DESIGN: ${JSON.stringify(design)}

Output this exact JSON (no markdown, no explanation):
{
  "ui_schema": {
    "pages": [
      {
        "name": "PageName",
        "path": "/path",
        "layout": "dashboard",
        "components": [
          {
            "type": "Table",
            "id": "unique_component_id",
            "props": {},
            "api_endpoint": "endpoint_id_that_exists_in_api_schema"
          }
        ]
      }
    ]
  },
  "api_schema": {
    "base_url": "/api/v1",
    "endpoints": [
      {
        "id": "unique_endpoint_id",
        "method": "GET",
        "path": "/resource",
        "auth_required": true,
        "roles_allowed": ["role"],
        "request_body": {
          "fields": [{"name": "field", "type": "string", "required": true}]
        },
        "response_body": {
          "fields": [{"name": "field", "type": "string"}]
        },
        "db_table": "table_name"
      }
    ]
  },
  "db_schema": {
    "tables": [
      {
        "name": "table_name",
        "columns": [
          {"name": "id", "type": "uuid", "nullable": false, "primary_key": true, "foreign_key": null},
          {"name": "created_at", "type": "timestamp", "nullable": false, "primary_key": false, "foreign_key": null},
          {"name": "updated_at", "type": "timestamp", "nullable": false, "primary_key": false, "foreign_key": null}
        ],
        "indexes": [{"columns": ["id"], "unique": true}]
      }
    ]
  },
  "auth_rules": {
    "strategy": "JWT",
    "token_expiry": "7d",
    "roles": [
      {
        "name": "role_name",
        "permissions": [
          {
            "resource": "table_name",
            "actions": ["create", "read", "update", "delete"]
          }
        ]
      }
    ],
    "protected_routes": ["/path"]
  }
}
`;

export const STAGE5_REPAIR_PROMPT = (
  brokenSection: object,
  error: string,
  context: object
) => `
You are a schema repair engine. A section failed validation.

BROKEN SECTION:
${JSON.stringify(brokenSection, null, 2)}

VALIDATION ERROR:
${error}

CONTEXT (must be consistent with):
${JSON.stringify(context, null, 2)}

Fix ONLY the broken section. Output ONLY the corrected JSON. No explanation.
`;