import { ID, Query } from 'node-appwrite';
import type { MigrationContext, MigrationLedger } from './types.js';

/** Table qui porte l'état des migrations, dans la base cible elle-même. */
export const MIGRATIONS_TABLE = 'migrations';

const PAGE_SIZE = 100;
const NOT_FOUND = 404;

interface MigrationRow {
  $id: string;
  migrationId: string;
}

/** Dépendance structurelle minimale — permet l'injection d'un faux en test. */
export interface LedgerTablesDb {
  listRows(p: {
    databaseId: string; tableId: string; queries?: string[];
  }): Promise<{ rows: MigrationRow[] }>;
  createRow(p: {
    databaseId: string; tableId: string; rowId: string;
    data: { migrationId: string; appliedAt: string };
  }): Promise<unknown>;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: number }).code === NOT_FOUND
  );
}

/** Registre persisté dans la table `migrations` de la base cible. */
export class AppwriteLedger implements MigrationLedger {
  private readonly tablesDB: LedgerTablesDb;
  private readonly databaseId: string;

  constructor(deps: { tablesDB: LedgerTablesDb; databaseId: string }) {
    this.tablesDB = deps.tablesDB;
    this.databaseId = deps.databaseId;
  }

  async applied(): Promise<ReadonlySet<string>> {
    const ids = new Set<string>();
    let cursor: string | undefined;

    try {
      for (;;) {
        const queries = [Query.limit(PAGE_SIZE)];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const page = await this.tablesDB.listRows({
          databaseId: this.databaseId,
          tableId: MIGRATIONS_TABLE,
          queries,
        });

        for (const row of page.rows) ids.add(row.migrationId);
        if (page.rows.length < PAGE_SIZE) break;
        cursor = page.rows.at(-1)?.$id;
      }
    } catch (error) {
      // Table absente = tout premier lancement (typiquement un --dry-run sur
      // une base neuve) : rien n'est appliqué, ce n'est pas une erreur.
      // Tout autre code remonte : un 401 ne doit jamais passer pour
      // « aucune migration appliquée », ce qui ferait tout rejouer.
      if (isNotFound(error)) return new Set();
      throw error;
    }

    return ids;
  }

  async record(id: string): Promise<void> {
    await this.tablesDB.createRow({
      databaseId: this.databaseId,
      tableId: MIGRATIONS_TABLE,
      rowId: ID.unique(),
      data: { migrationId: id, appliedAt: new Date().toISOString() },
    });
  }
}

/**
 * Provisionne la table du registre. Idempotent, et conscient du dry-run
 * puisqu'il passe par le contexte.
 */
export async function bootstrapLedger(ctx: MigrationContext): Promise<void> {
  await ctx.ensureTable(MIGRATIONS_TABLE, 'Registre des migrations');
  await ctx.ensureVarcharColumn(MIGRATIONS_TABLE, 'migrationId', 255, { required: true });
  await ctx.ensureDatetimeColumn(MIGRATIONS_TABLE, 'appliedAt', { required: true });
  await ctx.ensureIndex(MIGRATIONS_TABLE, 'idx_migration_id', 'unique', ['migrationId']);
}
