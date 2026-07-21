import { IndexType } from 'node-appwrite';
import type { MigrationContext } from './types.js';
/**
 * Dépendance structurelle minimale sur `TablesDB`.
 *
 * On ne dépend pas de la classe concrète : le contexte devient injectable, et
 * les tests exercent le vrai code d'idempotence sans réseau ni instance SDK.
 */
export interface TablesDbLike {
    createTable(p: {
        databaseId: string;
        tableId: string;
        name: string;
    }): Promise<unknown>;
    createVarcharColumn(p: {
        databaseId: string;
        tableId: string;
        key: string;
        size: number;
        required: boolean;
        xdefault?: string;
    }): Promise<unknown>;
    createEnumColumn(p: {
        databaseId: string;
        tableId: string;
        key: string;
        elements: string[];
        required: boolean;
        xdefault?: string;
    }): Promise<unknown>;
    createDatetimeColumn(p: {
        databaseId: string;
        tableId: string;
        key: string;
        required: boolean;
        xdefault?: string;
    }): Promise<unknown>;
    createIndex(p: {
        databaseId: string;
        tableId: string;
        key: string;
        type: IndexType;
        columns: string[];
    }): Promise<unknown>;
    getColumn(p: {
        databaseId: string;
        tableId: string;
        key: string;
    }): Promise<{
        status: string;
    }>;
}
/** Délai de garde du sondage de disponibilité des colonnes. */
export declare const COLUMN_READY_TIMEOUT_MS = 30000;
export declare function createMigrationContext(deps: {
    tablesDB: TablesDbLike;
    databaseId: string;
    dryRun: boolean;
    log?: (message: string) => void;
}): MigrationContext;
