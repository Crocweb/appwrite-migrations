/**
 * Moteur de migrations Appwrite — API publique.
 *
 * Le paquet ne lit jamais l'environnement : toute la configuration arrive en
 * argument de `migrate`. Voir le README pour le script d'entrée à recopier
 * dans un projet consommateur.
 */

export type {
  AppliedMigration,
  IndexKind,
  Migration,
  MigrationContext,
  MigrationLedger,
  RunMigrationsResult,
} from './types.js';
export { MigrationFailedError } from './types.js';

export { runMigrations } from './engine.js';
export { createMigrationContext, COLUMN_READY_TIMEOUT_MS } from './context.js';
export type { TablesDbLike } from './context.js';
export { AppwriteLedger, bootstrapLedger, MIGRATIONS_TABLE } from './ledger.js';
export type { LedgerTablesDb } from './ledger.js';
