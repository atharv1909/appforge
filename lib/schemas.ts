import { z } from 'zod';

export const IntentSchema = z.object({
  domain: z.string().min(1),
  app_name: z.string().min(1),
  features: z.array(z.string()).min(1),
  entities: z.array(z.string()).min(1),
  roles: z.array(z.string()).min(1),
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
    accessible_by: z.array(z.string()),
    components: z.array(z.string()),
  })).min(1),
  flows: z.array(z.object({
    name: z.string(),
    trigger: z.string(),
    steps: z.array(z.string()).min(1).catch(['start', 'end']),
    outcome: z.string(),
  })).catch([]),
  auth_model: z.object({
    type: z.enum(['RBAC', 'simple', 'none']).catch('RBAC'),
    roles: z.array(z.string()),
    permissions: z.unknown().transform(() => ({})),
  }),
  entity_relations: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.enum(['one-to-many', 'many-to-many', 'one-to-one']).catch('one-to-many'),
    field: z.string(),
  })),
 navigation: z.object({
    sidebar: z.array(z.string()).catch([]),
    topbar: z.array(z.string()).catch([]),
  }).catch({ sidebar: [], topbar: [] }),
});

export const ColumnSchema = z.object({
  name: z.string(),
  type: z.enum(['uuid', 'varchar', 'text', 'integer', 'boolean', 'timestamp', 'decimal', 'json']).catch('varchar'),
  nullable: z.boolean(),
  primary_key: z.boolean(),
  foreign_key: z.string().nullable(),
});

export const TableSchema = z.object({
  name: z.string(),
  columns: z.array(ColumnSchema).min(1),
  indexes: z.array(z.object({
    columns: z.array(z.string()),
    unique: z.boolean(),
  })),
});

export const EndpointSchema = z.object({
  id: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).catch('GET'),
  path: z.string(),
  auth_required: z.boolean(),
  roles_allowed: z.array(z.string()),
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
    })),
  }),
  db_table: z.string().nullable().catch('unknown').transform(v => v ?? 'unknown'),
});

export const UIComponentSchema = z.object({
  type: z.enum(['Table', 'Form', 'Card', 'Chart', 'Modal', 'Button', 'List', 'Stats']).catch('Card'),
  id: z.string(),
  props: z.record(z.string(), z.unknown()),
  api_endpoint: z.string(),
});

export const UIPageSchema = z.object({
  name: z.string(),
  path: z.string(),
  layout: z.enum(['dashboard', 'auth', 'detail', 'list', 'landing']).catch('dashboard'),
  components: z.array(UIComponentSchema).min(1),
});

export const AuthRoleSchema = z.object({
  name: z.string(),
  permissions: z.array(z.object({
    resource: z.string(),
    actions: z.array(z.enum(['create', 'read', 'update', 'delete'])),
  })),
});

export const SchemaOutputSchema = z.object({
  ui_schema: z.object({ pages: z.array(UIPageSchema).min(1) }),
  api_schema: z.object({
    base_url: z.string(),
    endpoints: z.array(EndpointSchema).min(1),
  }),
  db_schema: z.object({ tables: z.array(TableSchema).min(1) }),
  auth_rules: z.object({
    strategy: z.enum(['JWT', 'session']).catch('JWT'),
    token_expiry: z.string(),
    roles: z.array(AuthRoleSchema).min(1),
    protected_routes: z.array(z.string()).catch([]),
  }),
});

export type IntentOutput = z.infer<typeof IntentSchema>;
export type DesignOutput = z.infer<typeof DesignSchema>;
export type SchemaOutput = z.infer<typeof SchemaOutputSchema>;
