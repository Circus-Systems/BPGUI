const BLOCKED_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "COPY",
];

const BLOCKED_SCHEMAS = [
  "pg_catalog",
  "information_schema",
  "auth",
  "storage",
  "supabase_migrations",
  "supabase_functions",
  "extensions",
  "vault",
  "realtime",
];

export function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim().toUpperCase();

  // Must start with SELECT or WITH
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }

  // Block write keywords
  for (const keyword of BLOCKED_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(sql)) {
      return { valid: false, error: `${keyword} statements are not allowed.` };
    }
  }

  // Block system schemas
  for (const schema of BLOCKED_SCHEMAS) {
    if (sql.toLowerCase().includes(schema)) {
      return {
        valid: false,
        error: `Access to ${schema} schema is not allowed.`,
      };
    }
  }

  // Block multiple statements
  const withoutStrings = sql.replace(/'[^']*'/g, "");
  if (withoutStrings.includes(";") && withoutStrings.indexOf(";") < withoutStrings.length - 1) {
    return { valid: false, error: "Multiple statements are not allowed." };
  }

  return { valid: true };
}

export function injectLimit(sql: string, maxRows = 1000): string {
  const upper = sql.toUpperCase();
  const limitMatch = upper.match(/LIMIT\s+(\d+)/);

  if (limitMatch) {
    const existing = parseInt(limitMatch[1], 10);
    if (existing > maxRows) {
      return sql.replace(/LIMIT\s+\d+/i, `LIMIT ${maxRows}`);
    }
    return sql;
  }

  // Add LIMIT if missing
  const trimmed = sql.trimEnd().replace(/;$/, "");
  return `${trimmed} LIMIT ${maxRows}`;
}
