import { type TablesDbLike } from './context.js';
import { type LedgerTablesDb } from './ledger.js';
import { type Migration, type RunMigrationsResult } from './types.js';
/**
 * Tout ce que l'orchestration attend du SDK : les helpers de schéma, le
 * registre, et la lecture de la base. Structurel, donc injectable en test.
 */
export interface MigrationsTablesDb extends TablesDbLike, LedgerTablesDb {
    get(p: {
        databaseId: string;
    }): Promise<unknown>;
}
export interface MigrateWithOptions {
    tablesDB: MigrationsTablesDb;
    databaseId: string;
    migrations: readonly Migration[];
    dryRun?: boolean;
    log?: (message: string) => void;
}
export interface MigrateOptions {
    /** Défaut : https://cloud.appwrite.io/v1 */
    endpoint?: string;
    projectId: string;
    apiKey: string;
    databaseId: string;
    migrations: readonly Migration[];
    dryRun?: boolean;
    log?: (message: string) => void;
}
/**
 * Applique les migrations contre un `TablesDB` déjà construit.
 *
 * Ne lit rien de l'environnement, ne termine jamais le processus : journalise,
 * renvoie le résultat, et lève en cas d'échec. Le code de sortie appartient à
 * l'appelant.
 */
export declare function migrateWith(options: MigrateWithOptions): Promise<RunMigrationsResult>;
/**
 * Point d'entrée normal : construit le client Appwrite depuis la configuration
 * fournie par le projet consommateur, puis délègue.
 *
 * Aucune valeur n'est devinée. `databaseId` n'a volontairement pas de défaut :
 * une migration doit toujours savoir contre quoi elle tourne.
 */
export declare function migrate(options: MigrateOptions): Promise<RunMigrationsResult>;
