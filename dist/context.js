import { IndexType } from 'node-appwrite';
const ALREADY_EXISTS = 409;
/** Délai de garde du sondage de disponibilité des colonnes. */
export const COLUMN_READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;
const INDEX_TYPES = {
    key: IndexType.Key,
    unique: IndexType.Unique,
    fulltext: IndexType.Fulltext,
};
function isAlreadyExists(error) {
    return (typeof error === 'object' &&
        error !== null &&
        error.code === ALREADY_EXISTS);
}
export function createMigrationContext(deps) {
    const { tablesDB, databaseId, dryRun } = deps;
    const log = deps.log ?? ((message) => console.log(message));
    /**
     * Patron unique de tous les helpers : en dry-run on journalise sans jamais
     * toucher le SDK ; en mode réel on avale le 409 (la ressource existe déjà,
     * c'est le cas nominal d'un rejeu) et on relance tout le reste.
     */
    async function ensure(label, call) {
        if (dryRun) {
            log(`  · (dry-run) ${label}`);
            return;
        }
        try {
            await call();
            log(`  ✓ ${label}`);
        }
        catch (error) {
            if (isAlreadyExists(error)) {
                log(`  = ${label} (existe déjà)`);
                return;
            }
            throw error;
        }
    }
    /**
     * Appwrite provisionne les colonnes de façon ASYNCHRONE : créer un index sur
     * une colonne encore en cours de création échoue, de façon intermittente
     * donc incompréhensible. On sonde jusqu'au statut `available`.
     */
    async function waitForColumn(tableId, key) {
        const deadline = Date.now() + COLUMN_READY_TIMEOUT_MS;
        for (;;) {
            const column = await tablesDB.getColumn({ databaseId, tableId, key });
            if (column.status === 'available')
                return;
            if (column.status === 'failed') {
                throw new Error(`la colonne ${tableId}.${key} est en statut failed`);
            }
            if (Date.now() > deadline) {
                throw new Error(`délai dépassé en attendant la colonne ${tableId}.${key}`);
            }
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }
    return {
        databaseId,
        dryRun,
        log,
        ensureTable: (tableId, name) => ensure(`table ${tableId}`, () => tablesDB.createTable({ databaseId, tableId, name })),
        ensureVarcharColumn: (tableId, key, size, opts) => ensure(`colonne ${tableId}.${key} (varchar ${size})`, () => tablesDB.createVarcharColumn({
            databaseId, tableId, key, size,
            required: opts?.required ?? false,
            ...(opts?.xdefault !== undefined ? { xdefault: opts.xdefault } : {}),
        })),
        ensureEnumColumn: (tableId, key, elements, opts) => ensure(`colonne ${tableId}.${key} (enum)`, () => tablesDB.createEnumColumn({
            databaseId, tableId, key, elements,
            required: opts?.required ?? false,
            ...(opts?.xdefault !== undefined ? { xdefault: opts.xdefault } : {}),
        })),
        ensureDatetimeColumn: (tableId, key, opts) => ensure(`colonne ${tableId}.${key} (datetime)`, () => tablesDB.createDatetimeColumn({
            databaseId, tableId, key, required: opts?.required ?? false,
        })),
        ensureIndex: async (tableId, key, type, columns) => {
            if (!dryRun) {
                for (const column of columns)
                    await waitForColumn(tableId, column);
            }
            await ensure(`index ${tableId}.${key} (${type})`, () => tablesDB.createIndex({
                databaseId, tableId, key, type: INDEX_TYPES[type], columns,
            }));
        },
    };
}
