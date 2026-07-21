/**
 * Contrats du moteur de migrations Appwrite.
 *
 * Porté depuis ez-coach (packages/kernel/adapters-appwrite), traduit du
 * vocabulaire collections/documents/attributes vers tables/rows/columns —
 * `Databases` est déprécié depuis Appwrite 1.8.0 au profit de `TablesDB`.
 */
export type IndexKind = 'key' | 'unique' | 'fulltext';
/**
 * Helpers idempotents mis à disposition des migrations.
 *
 * Une migration ne doit JAMAIS appeler le SDK directement : c'est ici, et
 * seulement ici, que vivent l'absorption du 409 (« existe déjà ») et le
 * mode `--dry-run`. Un appel direct au SDK perdrait les deux d'un coup.
 */
export interface MigrationContext {
    readonly databaseId: string;
    readonly dryRun: boolean;
    ensureTable(tableId: string, name: string): Promise<void>;
    ensureVarcharColumn(tableId: string, key: string, size: number, opts?: {
        required?: boolean;
        xdefault?: string;
    }): Promise<void>;
    ensureEnumColumn(tableId: string, key: string, elements: string[], opts?: {
        required?: boolean;
        xdefault?: string;
    }): Promise<void>;
    ensureDatetimeColumn(tableId: string, key: string, opts?: {
        required?: boolean;
    }): Promise<void>;
    ensureIndex(tableId: string, key: string, type: IndexKind, columns: string[]): Promise<void>;
    log(message: string): void;
}
export interface Migration {
    /** Identifiant stable, unique et triable (ex. `0001_leads`). */
    id: string;
    /** Libellé lisible. */
    name: string;
    /** Étape avant. Il n'y a pas d'étape arrière : le moteur est forward-only. */
    up: (ctx: MigrationContext) => Promise<void>;
}
/**
 * Mémoire des migrations déjà appliquées.
 *
 * PORT : le moteur ignore où l'état est rangé. En production c'est une table
 * Appwrite, en test un `Set` en mémoire — c'est ce qui rend l'ordre,
 * l'idempotence et le dry-run vérifiables sans réseau.
 */
export interface MigrationLedger {
    applied(): Promise<ReadonlySet<string>>;
    record(id: string): Promise<void>;
}
export interface AppliedMigration {
    id: string;
    appliedAt: Date;
}
export interface RunMigrationsResult {
    applied: AppliedMigration[];
    skipped: string[];
}
export declare class MigrationFailedError extends Error {
    readonly migrationId: string;
    constructor(migrationId: string, cause: unknown);
}
/**
 * Configuration invalide : option obligatoire vide.
 *
 * Distincte de `MigrationFailedError` : rien n'a été tenté, aucun appel réseau
 * n'a eu lieu, et l'appelant n'a pas à se demander si le schéma est partiel.
 */
export declare class MigrationConfigError extends Error {
    readonly option: string;
    constructor(option: string, message: string);
}
