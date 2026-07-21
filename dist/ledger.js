import { ID, Query } from 'node-appwrite';
/** Table qui porte l'état des migrations, dans la base cible elle-même. */
export const MIGRATIONS_TABLE = 'migrations';
const PAGE_SIZE = 100;
const NOT_FOUND = 404;
function isNotFound(error) {
    return (typeof error === 'object' && error !== null && error.code === NOT_FOUND);
}
/** Registre persisté dans la table `migrations` de la base cible. */
export class AppwriteLedger {
    tablesDB;
    databaseId;
    constructor(deps) {
        this.tablesDB = deps.tablesDB;
        this.databaseId = deps.databaseId;
    }
    async applied() {
        const ids = new Set();
        let cursor;
        try {
            for (;;) {
                const queries = [Query.limit(PAGE_SIZE)];
                if (cursor)
                    queries.push(Query.cursorAfter(cursor));
                const page = await this.tablesDB.listRows({
                    databaseId: this.databaseId,
                    tableId: MIGRATIONS_TABLE,
                    queries,
                });
                for (const row of page.rows)
                    ids.add(row.migrationId);
                if (page.rows.length < PAGE_SIZE)
                    break;
                cursor = page.rows.at(-1)?.$id;
            }
        }
        catch (error) {
            // Table absente = tout premier lancement (typiquement un --dry-run sur
            // une base neuve) : rien n'est appliqué, ce n'est pas une erreur.
            // Tout autre code remonte : un 401 ne doit jamais passer pour
            // « aucune migration appliquée », ce qui ferait tout rejouer.
            if (isNotFound(error))
                return new Set();
            throw error;
        }
        return ids;
    }
    async record(id) {
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
export async function bootstrapLedger(ctx) {
    await ctx.ensureTable(MIGRATIONS_TABLE, 'Registre des migrations');
    await ctx.ensureVarcharColumn(MIGRATIONS_TABLE, 'migrationId', 255, { required: true });
    await ctx.ensureDatetimeColumn(MIGRATIONS_TABLE, 'appliedAt', { required: true });
    await ctx.ensureIndex(MIGRATIONS_TABLE, 'idx_migration_id', 'unique', ['migrationId']);
}
