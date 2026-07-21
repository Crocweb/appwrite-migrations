import { type Migration, type MigrationContext, type MigrationLedger, type RunMigrationsResult } from './types.js';
/**
 * Applique les migrations en attente, dans l'ordre trié des `id`, en
 * enregistrant chacune après son succès.
 *
 * Idempotent : une migration déjà enregistrée est sautée.
 *
 * ⚠️ Appwrite n'a pas de transactions. Une migration qui échoue à mi-parcours
 * laisse le schéma partiel, et comme elle n'est PAS enregistrée, le prochain
 * lancement la rejoue depuis le début. Cela ne fonctionne que parce que
 * chaque étape du contexte est idempotente — c'est l'invariant central de
 * l'outil, et il repose sur une discipline d'écriture des migrations.
 */
export declare function runMigrations(ctx: MigrationContext, ledger: MigrationLedger, migrations: readonly Migration[]): Promise<RunMigrationsResult>;
