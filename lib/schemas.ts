import { z } from 'zod';

export const IntentSchema = z.object({
  domain: z.string().min(1),
  app_name: z.string().min(1),
  features: z.array(z.string()).min(1),
 entities: z.array(z.string()).min(1).catch(['User']),
roles: z.array(z.string()).min(1).catch(['admin']),
  auth_required: z.boolean(),
  payment_required: z.boolean(),
  analytics_required: z.boolean(),
  assumptions: z.array(z.string()),
  conflicts: z.array(z.string()),
  clarifications_needed: z.array(z.string()),
  complexity: z.enum(['simple', 'medium', 'complex']).catch('medium'),
});

export const DesignSchema = z.object({
  pages: z.array(z.object({
    name: z.string(),
    path: z.string(),
    accessible_by: z.array(z.string()).catch([]),
    components: z.array(z.string()).catch([]),
  })).min(1),
  flows: z.array(z.object({
    name: z.string(),
    trigger: z.string(),
    steps: z.array(z.string()).catch(['start', 'end']),
    outcome: z.string(),
  })).catch([]),
  auth_model: z.object({
    type: z.enum(['RBAC', 'simple', 'none']).catch('RBAC'),
    roles: z.array(z.string()).catch([]),
    permissions: z.unknown().transform(() => ({})),
  }).catch({ type: 'RBAC', roles: [], permissions: {} }),
  entity_relations: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.enum(['one-to-many', 'many-to-many', 'one-to-one']).catch('one-to-many'),
    field: z.string(),
  })).catch([]),
  navigation: z.object({
    sidebar: z.array(z.string()).catch([]),
    topbar: z.array(z.string()).catch([]),
  }).catch({ sidebar: [], topbar: [] }),
});

export const ColumnSchema = z.object({
  name: z.string(),
  type: z.enum(['uuid', 'varchar', 'text', 'integer', 'boolean', 'timestamp', 'decimal', 'json']).catch('varchar'),
  nullable: z.boolean().catch(false),
  primary_key: z.boolean().catch(false),
  foreign_key: z.string().nullable().catch(null),
});

export const TableSchema = z.object({
  name: z.string(),
  columns: z.array(ColumnSchema).min(1),
  indexes: z.array(z.object({
    columns: z.array(z.string()).catch([]),
    unique: z.boolean().catch(false),
  })).catch([]),
});

export const EndpointSchema = z.object({
  id: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).catch('GET'),
  path: z.string(),
  auth_required: z.boolean().catch(true),
  roles_allowed: z.array(z.string()).catch([]),
  request_body: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean().catch(false),
    })).catch([]),
  }).catch({ fields: [] }),
  response_body: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })).catch([]),
  }).catch({ fields: [] }),
  db_table: z.string().nullable().catch('unknown').transform(v => v ?? 'unknown'),
});

export const UIComponentSchema = z.object({
  type: z.enum(['Table', 'Form', 'Card', 'Chart', 'Modal', 'Button', 'List', 'Stats']).catch('Card'),
  id: z.string(),
  props: z.unknown().transform(v => (typeof v === 'object' && v !== null ? v : {})),
  api_endpoint: z.string(),
});

export const UIPageSchema = z.object({
  name: z.string(),
  path: z.string(),
  layout: z.enum(['dashboard', 'auth', 'detail', 'list', 'landing']).catch('dashboard'),
  components: z.array(UIComponentSchema).catch([]),
});

export const AuthRoleSchema = z.object({
  name: z.string(),
  permissions: z.array(z.object({
    resource: z.string(),
    actions: z.array(z.enum(['create', 'read', 'update', 'delete'])).catch([]),
  })).catch([]),
});

export const SchemaOutputSchema = z.object({
  ui_schema: z.object({
    pages: z.array(UIPageSchema).min(1),
  }),
  api_schema: z.object({
    base_url: z.string().catch('/api/v1'),
    endpoints: z.array(EndpointSchema).min(1),
  }),
  db_schema: z.object({
    tables: z.array(TableSchema).min(1),
  }),
  auth_rules: z.object({
    strategy: z.enum(['JWT', 'session']).catch('JWT'),
    token_expiry: z.string().catch('7d'),
    roles: z.array(AuthRoleSchema).min(1),
    protected_routes: z.array(z.string()).catch([]),
  }),
});

export type IntentOutput = z.infer<typeof IntentSchema>;
export type DesignOutput = z.infer<typeof DesignSchema>;
export type SchemaOutput = z.infer<typeof SchemaOutputSchema>;
