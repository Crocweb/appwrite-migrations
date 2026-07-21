import type { MigrationContext, MigrationLedger } from './types.js';
/** Table qui porte l'état des migrations, dans la base cible elle-même. */
export declare const MIGRATIONS_TABLE = "migrations";
interface MigrationRow {
    $id: string;
    migrationId: string;
}
/** Dépendance structurelle minimale — permet l'injection d'un faux en test. */
export interface LedgerTablesDb {
    listRows(p: {
        databaseId: string;
        tableId: string;
        queries?: string[];
    }): Promise<{
        rows: MigrationRow[];
    }>;
    createRow(p: {
        databaseId: string;
        tableId: string;
        rowId: string;
        data: {
            migrationId: string;
            appliedAt: string;
        };
    }): Promise<unknown>;
}
/** Registre persisté dans la table `migrations` de la base cible. */
export declare class AppwriteLedger implements MigrationLedger {
    private readonly tablesDB;
    private readonly databaseId;
    constructor(deps: {
        tablesDB: LedgerTablesDb;
        databaseId: string;
    });
    applied(): Promise<ReadonlySet<string>>;
    record(id: string): Promise<void>;
}
/**
 * Provisionne la table du registre. Idempotent, et conscient du dry-run
 * puisqu'il passe par le contexte.
 */
export declare function bootstrapLedger(ctx: MigrationContext): Promise<void>;
export {};
