/**
 * Moteur de migrations Appwrite — API publique.
 *
 * Le paquet ne lit jamais l'environnement : toute la configuration arrive en
 * argument de `migrate`. Voir le README pour le script d'entrée à recopier
 * dans un projet consommateur.
 */
export { MigrationConfigError, MigrationFailedError } from './types.js';
export { migrate, migrateWith } from './migrate.js';
export { runMigrations } from './engine.js';
export { createMigrationContext, COLUMN_READY_TIMEOUT_MS } from './context.js';
export { AppwriteLedger, bootstrapLedger, MIGRATIONS_TABLE } from './ledger.js';
