import type { SchemaOutput } from './schemas';
import type { ValidationError } from './validator';

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function inferColumnType(type: string): 'uuid' | 'varchar' | 'text' | 'integer' | 'boolean' | 'timestamp' | 'decimal' | 'json' {
  if (type.includes('int') || type.includes('number')) return 'integer';
  if (type.includes('bool')) return 'boolean';
  if (type.includes('date') || type.includes('time')) return 'timestamp';
  if (type.includes('decimal') || type.includes('float')) return 'decimal';
  if (type.includes('uuid')) return 'uuid';
  if (type.includes('text')) return 'text';
  return 'varchar';
}

function inferTableFromEndpointId(endpointId: string): string {
  const parts = endpointId.split('_');
  return parts[parts.length - 1] || endpointId;
}

export function applyCodeRepair(
  schema: SchemaOutput,
  error: ValidationError
): { success: boolean; schema: SchemaOutput } {
  const s = deepClone(schema);

  switch (error.repair_action) {
    case 'ADD_MISSING_ENDPOINT': {
      const { component } = error.repair_data;
      const inferredTable = inferTableFromEndpointId(component.api_endpoint);
      s.api_schema.endpoints.push({
        id: component.api_endpoint,
        method: component.type === 'Form' ? 'POST' : 'GET',
        path: `/${component.api_endpoint.replace(/_/g, '/')}`,
        auth_required: true,
        roles_allowed: ['admin'],
        request_body: { fields: [] },
        response_body: { fields: [{ name: 'data', type: 'object' }] },
        db_table: inferredTable,
      });
      return { success: true, schema: s };
    }

    case 'ADD_MISSING_TABLE': {
      const { endpoint } = error.repair_data;
      s.db_schema.tables.push({
        name: endpoint.db_table,
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primary_key: true, foreign_key: null },
          { name: 'created_at', type: 'timestamp', nullable: false, primary_key: false, foreign_key: null },
          { name: 'updated_at', type: 'timestamp', nullable: false, primary_key: false, foreign_key: null },
        ],
        indexes: [{ columns: ['id'], unique: true }],
      });
      return { success: true, schema: s };
    }

    case 'ADD_MISSING_COLUMN': {
      const { table_name, field } = error.repair_data;
      const table = s.db_schema.tables.find(t => t.name === table_name);
      if (table) {
        table.columns.push({
          name: field.name,
          type: inferColumnType(field.type),
          nullable: !field.required,
          primary_key: false,
          foreign_key: null,
        });
        return { success: true, schema: s };
      }
      return { success: false, schema: s };
    }

    case 'ADD_USERS_TABLE': {
      s.db_schema.tables.push({
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primary_key: true, foreign_key: null },
          { name: 'email', type: 'varchar', nullable: false, primary_key: false, foreign_key: null },
          { name: 'password_hash', type: 'varchar', nullable: false, primary_key: false, foreign_key: null },
          { name: 'role', type: 'varchar', nullable: false, primary_key: false, foreign_key: null },
          { name: 'created_at', type: 'timestamp', nullable: false, primary_key: false, foreign_key: null },
          { name: 'updated_at', type: 'timestamp', nullable: false, primary_key: false, foreign_key: null },
        ],
        indexes: [{ columns: ['email'], unique: true }],
      });
      return { success: true, schema: s };
    }

    case 'REMOVE_INVALID_PROTECTED_ROUTE': {
      const { route } = error.repair_data;
      s.auth_rules.protected_routes = s.auth_rules.protected_routes.filter(r => r !== route);
      return { success: true, schema: s };
    }

    case 'REMOVE_DUPLICATE_TABLE': {
      const { table_name } = error.repair_data;
      let seen = false;
      s.db_schema.tables = s.db_schema.tables.filter(t => {
        if (t.name === table_name) {
          if (!seen) { seen = true; return true; }
          return false;
        }
        return true;
      });
      return { success: true, schema: s };
    }

    default:
      return { success: false, schema: s };
  }
}

export async function repairSchema(
  schema: SchemaOutput,
  errors: ValidationError[]
): Promise<{ schema: SchemaOutput; repaired: number; failed: number }> {
  let repairedSchema = deepClone(schema);
  let repaired = 0;
  let failed = 0;

  for (const error of errors) {
    if (error.auto_repairable) {
      const result = applyCodeRepair(repairedSchema, error);
      if (result.success) {
        repairedSchema = result.schema;
        repaired++;
      } else {
        failed++;
      }
    } else {
      failed++;
    }
  }

  return { schema: repairedSchema, repaired, failed };
}