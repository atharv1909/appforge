import type { SchemaOutput } from './schemas';

export interface RuntimeOutput {
  execution_valid: boolean;
  files_generated: number;
  react_components: { name: string; code: string }[];
  express_routes: string;
  db_migration: string;
  cross_references_verified: number;
  issues: string[];
}

export function generateRuntime(schema: SchemaOutput): RuntimeOutput {
  const reactComponents = generateReactComponents(schema);
  const expressRoutes = generateExpressRoutes(schema);
  const dbMigration = generateDbMigration(schema);
  const { verified, issues } = verifyCrossReferences(schema, expressRoutes, dbMigration);

  return {
    execution_valid: issues.length === 0,
    files_generated: reactComponents.length + 2,
    react_components: reactComponents,
    express_routes: expressRoutes,
    db_migration: dbMigration,
    cross_references_verified: verified,
    issues,
  };
}
export function generateERD(schema: SchemaOutput): string {
  const tables = schema.db_schema.tables;
  const tableWidth = 180;
  const tableHeaderHeight = 36;
  const rowHeight = 24;
  const padding = 40;
  const cols = Math.min(3, tables.length);
  const rows = Math.ceil(tables.length / cols);

  const totalWidth = cols * (tableWidth + padding) + padding;
  const maxRows = Math.max(...Array.from({ length: cols }, (_, ci) =>
    tables.filter((_, i) => i % cols === ci).length
  ));
  const maxTableHeight = tableHeaderHeight + rowHeight * 8;
  const totalHeight = rows * (maxTableHeight + padding) + padding;

  const tablePositions: Record<string, { x: number; y: number; height: number }> = {};

  const tableSvgs = tables.map((table, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = padding + col * (tableWidth + padding);
    const y = padding + row * (maxTableHeight + padding);
    const height = tableHeaderHeight + Math.min(table.columns.length, 8) * rowHeight;

    tablePositions[table.name] = { x, y, height };

    const columnRows = table.columns.slice(0, 8).map((col, ci) => {
      const isPK = col.primary_key;
      const isFK = !!col.foreign_key;
      const icon = isPK ? '🔑' : isFK ? '🔗' : '·';
      const cy = tableHeaderHeight + ci * rowHeight;
      return `
        <rect x="${x}" y="${y + cy}" width="${tableWidth}" height="${rowHeight}" 
          fill="${ci % 2 === 0 ? '#0d0d18' : '#0a0a12'}" />
        <text x="${x + 10}" y="${y + cy + 16}" font-size="10" fill="${isPK ? '#f59e0b' : isFK ? '#6366f1' : '#475569'}" font-family="monospace">
          ${icon}
        </text>
        <text x="${x + 24}" y="${y + cy + 16}" font-size="10" fill="${isPK ? '#f1f5f9' : '#94a3b8'}" font-family="monospace">
          ${col.name.length > 16 ? col.name.substring(0, 16) + '..' : col.name}
        </text>
        <text x="${x + tableWidth - 8}" y="${y + cy + 16}" font-size="9" fill="#2a2a4a" font-family="monospace" text-anchor="end">
          ${col.type}
        </text>
      `;
    }).join('');

    const moreText = table.columns.length > 8
      ? `<text x="${x + tableWidth / 2}" y="${y + height - 6}" font-size="9" fill="#2a2a4a" text-anchor="middle" font-family="monospace">+${table.columns.length - 8} more</text>`
      : '';

    return `
      <rect x="${x}" y="${y}" width="${tableWidth}" height="${height}" rx="6" fill="#12121f" stroke="#2a2a4a" stroke-width="1"/>
      <rect x="${x}" y="${y}" width="${tableWidth}" height="${tableHeaderHeight}" rx="6" fill="#1e1e3a"/>
      <rect x="${x}" y="${y + tableHeaderHeight - 6}" width="${tableWidth}" height="6" fill="#1e1e3a"/>
      <text x="${x + tableWidth / 2}" y="${y + 22}" font-size="12" font-weight="bold" fill="#818cf8" text-anchor="middle" font-family="monospace">
        ${table.name}
      </text>
      ${columnRows}
      ${moreText}
    `;
  });

  // Draw FK relationship lines
  const lines: string[] = [];
  tables.forEach(table => {
    table.columns.forEach(col => {
      if (col.foreign_key) {
        const refTable = col.foreign_key.split('.')[0];
        const from = tablePositions[table.name];
        const to = tablePositions[refTable];
        if (from && to) {
          const x1 = from.x + tableWidth;
          const y1 = from.y + from.height / 2;
          const x2 = to.x;
          const y2 = to.y + to.height / 2;
          const mx = (x1 + x2) / 2;
          lines.push(`
            <path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" 
              stroke="#6366f1" stroke-width="1.5" fill="none" stroke-dasharray="4,3" opacity="0.6"/>
            <circle cx="${x1}" cy="${y1}" r="3" fill="#6366f1" opacity="0.8"/>
            <circle cx="${x2}" cy="${y2}" r="3" fill="#6366f1" opacity="0.8"/>
          `);
        }
      }
    });
  });

  return `<svg viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="background:#080810;border-radius:8px;width:100%;height:auto;">
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a1a2a" stroke-width="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    ${lines.join('')}
    ${tableSvgs.join('')}
  </svg>`;
}
function generateReactComponents(schema: SchemaOutput): { name: string; code: string }[] {
  return schema.ui_schema.pages.map(page => {
    const componentName = page.name.replace(/\s+/g, '') + 'Page';
    const endpoints = schema.api_schema.endpoints.filter(ep =>
      page.components.some(c => c.api_endpoint === ep.id)
    );

    const fetchCalls = endpoints.map(ep => {
      const varName = ep.db_table + 'Data';
      return `
  // Fetches from: ${ep.method} ${ep.path}
  const [${varName}, set${capitalize(varName)}] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/v1${ep.path}', {
      headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
    }).then(r => r.json()).then(data => set${capitalize(varName)}(data));
  }, []);`;
    }).join('\n');

    const tableRenders = page.components.map(comp => {
      return `      {/* ${comp.type}: ${comp.id} → ${comp.api_endpoint} */}
      <div className="${comp.type.toLowerCase()}-component" data-endpoint="${comp.api_endpoint}">
        <h2>${comp.id}</h2>
      </div>`;
    }).join('\n');

    return {
      name: componentName,
      code: `// Auto-generated by AppForge Runtime Simulator
// Page: ${page.name} | Path: ${page.path} | Layout: ${page.layout}

import React, { useState, useEffect } from 'react';

export default function ${componentName}() {
${fetchCalls}

  return (
    <div className="${page.layout}-layout">
      <h1>${page.name}</h1>
${tableRenders}
    </div>
  );
}
`,
    };
  });
}

function generateExpressRoutes(schema: SchemaOutput): string {
  const routes = schema.api_schema.endpoints.map(ep => {
    const fields = ep.request_body.fields.map(f => f.name).join(', ');
    const bodyDestructure = fields ? `  const { ${fields} } = req.body;` : '';
    const roleCheck = ep.roles_allowed.length > 0
      ? `requireRole(['${ep.roles_allowed.join("', '")}'])`
      : 'authenticateJWT';

    return `
// ${ep.method} ${ep.path}
// Auth: ${ep.auth_required} | Roles: ${ep.roles_allowed.join(', ')}
// DB Table: ${ep.db_table}
router.${ep.method.toLowerCase()}('${ep.path}', authenticateJWT, ${roleCheck}, async (req, res) => {
  try {
${bodyDestructure}
    // DB: ${ep.method === 'GET' ? `SELECT * FROM ${ep.db_table}` : `INSERT/UPDATE INTO ${ep.db_table}`}
    res.${ep.method === 'POST' ? 'status(201).' : ''}json({ data: [], message: 'AppForge stub' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});`;
  }).join('\n');

  return `// Auto-generated by AppForge Runtime Simulator
const express = require('express');
const router = express.Router();
const { authenticateJWT, requireRole } = require('../middleware/auth');

${routes}

module.exports = router;
`;
}

function generateDbMigration(schema: SchemaOutput): string {
  const tables = schema.db_schema.tables.map(table => {
    const columns = table.columns.map(col => {
      let def = `  ${col.name} `;
      switch (col.type) {
        case 'uuid': def += col.primary_key ? 'UUID PRIMARY KEY DEFAULT gen_random_uuid()' : 'UUID'; break;
        case 'varchar': def += 'VARCHAR(255)'; break;
        case 'text': def += 'TEXT'; break;
        case 'integer': def += 'INTEGER'; break;
        case 'boolean': def += 'BOOLEAN DEFAULT false'; break;
        case 'timestamp': def += 'TIMESTAMP DEFAULT NOW()'; break;
        case 'decimal': def += 'DECIMAL(10,2)'; break;
        case 'json': def += 'JSONB'; break;
      }
      if (!col.nullable && !col.primary_key) def += ' NOT NULL';
      if (col.foreign_key) def += ` REFERENCES ${col.foreign_key} ON DELETE CASCADE`;
      return def;
    }).join(',\n');

    const indexes = table.indexes.map(idx =>
      `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX idx_${table.name}_${idx.columns.join('_')} ON ${table.name}(${idx.columns.join(', ')});`
    ).join('\n');

    return `CREATE TABLE ${table.name} (\n${columns}\n);\n${indexes}`;
  }).join('\n\n');

  return `-- Auto-generated by AppForge Runtime Simulator
-- Generated: ${new Date().toISOString()}

${tables}
`;
}

function verifyCrossReferences(
  schema: SchemaOutput,
  expressRoutes: string,
  dbMigration: string
): { verified: number; issues: string[] } {
  let verified = 0;
  const issues: string[] = [];

  schema.api_schema.endpoints.forEach(ep => {
    if (expressRoutes.includes(ep.path)) {
      verified++;
    } else {
      issues.push(`Endpoint ${ep.path} missing from Express routes`);
    }
  });

  schema.db_schema.tables.forEach(table => {
    if (dbMigration.includes(`CREATE TABLE ${table.name}`)) {
      verified++;
    } else {
      issues.push(`Table ${table.name} missing from DB migration`);
    }
  });

  return { verified, issues };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
