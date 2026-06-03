import type { IntentOutput, DesignOutput, SchemaOutput } from './schemas';

export interface ValidationError {
  check_id: string;
  severity: 'error' | 'warning';
  layer: 'ui' | 'api' | 'db' | 'auth' | 'cross';
  message: string;
  field_path: string;
  expected: string;
  found: string;
  auto_repairable: boolean;
  repair_action?: string;
  repair_data?: any;
}

export interface ValidationReport {
  passed: boolean;
  checks_run: number;
  checks_passed: number;
  errors: ValidationError[];
  warnings: string[];
}

export function runValidation(
  intent: IntentOutput,
  design: DesignOutput,
  schema: SchemaOutput
): ValidationReport {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // CHECK_01: Pages exist
  if (!schema.ui_schema.pages || schema.ui_schema.pages.length === 0) {
    errors.push({
      check_id: 'CHECK_01',
      severity: 'error',
      layer: 'ui',
      message: 'UI schema has no pages',
      field_path: 'ui_schema.pages',
      expected: 'At least one page',
      found: 'Empty array',
      auto_repairable: false,
    });
  }

  // CHECK_02: Endpoints exist
  if (!schema.api_schema.endpoints || schema.api_schema.endpoints.length === 0) {
    errors.push({
      check_id: 'CHECK_02',
      severity: 'error',
      layer: 'api',
      message: 'API schema has no endpoints',
      field_path: 'api_schema.endpoints',
      expected: 'At least one endpoint',
      found: 'Empty array',
      auto_repairable: false,
    });
  }

  // CHECK_03: Tables exist
  if (!schema.db_schema.tables || schema.db_schema.tables.length === 0) {
    errors.push({
      check_id: 'CHECK_03',
      severity: 'error',
      layer: 'db',
      message: 'DB schema has no tables',
      field_path: 'db_schema.tables',
      expected: 'At least one table',
      found: 'Empty array',
      auto_repairable: false,
    });
  }

  // CHECK_04: Roles exist
  if (!schema.auth_rules.roles || schema.auth_rules.roles.length === 0) {
    errors.push({
      check_id: 'CHECK_04',
      severity: 'error',
      layer: 'auth',
      message: 'Auth rules has no roles',
      field_path: 'auth_rules.roles',
      expected: 'At least one role',
      found: 'Empty array',
      auto_repairable: false,
    });
  }

  // CHECK_05: UI component api_endpoint → must exist in api_schema
  const endpointIds = new Set(schema.api_schema.endpoints.map(e => e.id));
  schema.ui_schema.pages.forEach(page => {
    page.components.forEach(comp => {
      if (!endpointIds.has(comp.api_endpoint)) {
        errors.push({
          check_id: 'CHECK_05',
          severity: 'error',
          layer: 'cross',
          message: `Component "${comp.id}" references missing endpoint "${comp.api_endpoint}"`,
          field_path: `ui_schema.pages.${page.name}.components.${comp.id}.api_endpoint`,
          expected: `One of: ${[...endpointIds].join(', ')}`,
          found: comp.api_endpoint,
          auto_repairable: true,
          repair_action: 'ADD_MISSING_ENDPOINT',
          repair_data: { component: comp, page_name: page.name },
        });
      }
    });
  });

  // CHECK_06: API endpoint db_table → must exist in db_schema
  const tableNames = new Set(schema.db_schema.tables.map(t => t.name));
  schema.api_schema.endpoints.forEach(endpoint => {
    if (!tableNames.has(endpoint.db_table)) {
      errors.push({
        check_id: 'CHECK_06',
        severity: 'error',
        layer: 'cross',
        message: `Endpoint "${endpoint.id}" references missing table "${endpoint.db_table}"`,
        field_path: `api_schema.endpoints.${endpoint.id}.db_table`,
        expected: `One of: ${[...tableNames].join(', ')}`,
        found: endpoint.db_table,
        auto_repairable: true,
        repair_action: 'ADD_MISSING_TABLE',
        repair_data: { endpoint },
      });
    }
  });

  // CHECK_07: API request fields → must exist as DB columns
  const skipFields = ['token', 'password', 'confirm_password', 'remember_me', 'current_password'];
  schema.api_schema.endpoints.forEach(endpoint => {
    const table = schema.db_schema.tables.find(t => t.name === endpoint.db_table);
    if (!table) return; // already caught by CHECK_06
    const columnNames = new Set(table.columns.map(c => c.name));
    endpoint.request_body.fields.forEach(field => {
      if (!columnNames.has(field.name) && !skipFields.includes(field.name)) {
        errors.push({
          check_id: 'CHECK_07',
          severity: 'error',
          layer: 'cross',
          message: `API field "${field.name}" in endpoint "${endpoint.id}" not found in table "${endpoint.db_table}"`,
          field_path: `api_schema.endpoints.${endpoint.id}.request_body.fields.${field.name}`,
          expected: `Column in table "${endpoint.db_table}"`,
          found: 'Missing column',
          auto_repairable: true,
          repair_action: 'ADD_MISSING_COLUMN',
          repair_data: { table_name: endpoint.db_table, field },
        });
      }
    });
  });

  // CHECK_08: Auth roles → must match intent roles
  const intentRoles = new Set(intent.roles);
  schema.auth_rules.roles.forEach(role => {
    if (!intentRoles.has(role.name)) {
      warnings.push(`Auth role "${role.name}" not found in intent roles — may be an alias`);
    }
  });

  // CHECK_09: Protected routes → must exist in ui_schema pages
  const pagePaths = new Set(schema.ui_schema.pages.map(p => p.path));
  schema.auth_rules.protected_routes.forEach(route => {
    if (!pagePaths.has(route)) {
      errors.push({
        check_id: 'CHECK_09',
        severity: 'error',
        layer: 'cross',
        message: `Protected route "${route}" not found in UI pages`,
        field_path: `auth_rules.protected_routes`,
        expected: `One of: ${[...pagePaths].join(', ')}`,
        found: route,
        auto_repairable: true,
        repair_action: 'REMOVE_INVALID_PROTECTED_ROUTE',
        repair_data: { route },
      });
    }
  });

  // CHECK_10: Each page has at least one component
  schema.ui_schema.pages.forEach(page => {
    if (!page.components || page.components.length === 0) {
      errors.push({
        check_id: 'CHECK_10',
        severity: 'error',
        layer: 'ui',
        message: `Page "${page.name}" has no components`,
        field_path: `ui_schema.pages.${page.name}.components`,
        expected: 'At least one component',
        found: 'Empty array',
        auto_repairable: false,
      });
    }
  });

  // CHECK_11: Auth required → users table must exist
  if (intent.auth_required) {
    const hasUsersTable = schema.db_schema.tables.some(t =>
      ['users', 'user', 'accounts', 'account', 'members'].includes(t.name.toLowerCase())
    );
    if (!hasUsersTable) {
      errors.push({
        check_id: 'CHECK_11',
        severity: 'error',
        layer: 'db',
        message: 'Auth is required but no users table found in DB schema',
        field_path: 'db_schema.tables',
        expected: 'A table named "users"',
        found: 'No users table',
        auto_repairable: true,
        repair_action: 'ADD_USERS_TABLE',
        repair_data: {},
      });
    }
  }

  // CHECK_12: Payment required → payments table must exist
  if (intent.payment_required) {
    const hasPaymentsTable = schema.db_schema.tables.some(t =>
      ['payments', 'payment', 'orders', 'subscriptions', 'transactions'].includes(t.name.toLowerCase())
    );
    if (!hasPaymentsTable) {
      warnings.push('Payment is required but no payments/orders table found — consider adding one');
    }
  }

  // CHECK_13: No duplicate table names
  const seenTables = new Set<string>();
  schema.db_schema.tables.forEach(table => {
    if (seenTables.has(table.name)) {
      errors.push({
        check_id: 'CHECK_13',
        severity: 'error',
        layer: 'db',
        message: `Duplicate table name: "${table.name}"`,
        field_path: `db_schema.tables.${table.name}`,
        expected: 'Unique table names',
        found: `Duplicate: ${table.name}`,
        auto_repairable: true,
        repair_action: 'REMOVE_DUPLICATE_TABLE',
        repair_data: { table_name: table.name },
      });
    }
    seenTables.add(table.name);
  });

  // CHECK_14: No duplicate endpoint paths+method combos
  const seenEndpoints = new Set<string>();
  schema.api_schema.endpoints.forEach(ep => {
    const key = `${ep.method}:${ep.path}`;
    if (seenEndpoints.has(key)) {
      warnings.push(`Duplicate endpoint: ${key}`);
    }
    seenEndpoints.add(key);
  });

  // CHECK_15: Auth rules resources → must match table names
  schema.auth_rules.roles.forEach(role => {
    role.permissions.forEach(perm => {
      if (!tableNames.has(perm.resource)) {
        warnings.push(`Auth permission resource "${perm.resource}" for role "${role.name}" doesn't match any DB table`);
      }
    });
  });

  const errorCount = errors.filter(e => e.severity === 'error').length;

  return {
    passed: errorCount === 0,
    checks_run: 15,
    checks_passed: 15 - errorCount,
    errors,
    warnings,
  };
}