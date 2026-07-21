import { Client, TablesDB } from 'node-appwrite';
import { createMigrationContext } from './context.js';
import { AppwriteLedger, bootstrapLedger } from './ledger.js';
import { runMigrations } from './engine.js';
import { MigrationConfigError, } from './types.js';
const NOT_FOUND = 404;
const DEFAULT_ENDPOINT = 'https://cloud.appwrite.io/v1';
function requireOption(option, value, why) {
    if (!value)
        throw new MigrationConfigError(option, why);
    return value;
}
/**
 * Applique les migrations contre un `TablesDB` déjà construit.
 *
 * Ne lit rien de l'environnement, ne termine jamais le processus : journalise,
 * renvoie le résultat, et lève en cas d'échec. Le code de sortie appartient à
 * l'appelant.
 */
export async function migrateWith(options) {
    const { tablesDB, databaseId, migrations, dryRun = false } = options;
    const log = options.log ?? ((message) => console.log(message));
    log(`▶ migrations → base "${databaseId}"${dryRun ? ' (dry-run)' : ''}`);
    // L'outil ne crée jamais la base : il refuse si elle manque, plutôt que de
    // fabriquer une cible que personne n'a demandée.
    try {
        await tablesDB.get({ databaseId });
    }
    catch (error) {
        if (error.code === NOT_FOUND) {
            throw new Error(`la base "${databaseId}" n'existe pas — créez-la dans la console Appwrite ` +
                '(Databases → Create database), puis relancez');
        }
        throw error;
    }
    const ctx = createMigrationContext({ tablesDB, databaseId, dryRun, log });
    log('· registre');
    await bootstrapLedger(ctx);
    const ledger = new AppwriteLedger({ tablesDB, databaseId });
    const result = await runMigrations(ctx, ledger, migrations);
    const verb = dryRun ? 'seraient appliquées' : 'appliquées';
    log(`\n✓ ${result.applied.length} ${verb} : [${result.applied.map((m) => m.id).join(', ')}]`);
    log(`  ${result.skipped.length} déjà en place : [${result.skipped.join(', ')}]`);
    return result;
}
/**
 * Point d'entrée normal : construit le client Appwrite depuis la configuration
 * fournie par le projet consommateur, puis délègue.
 *
 * Aucune valeur n'est devinée. `databaseId` n'a volontairement pas de défaut :
 * une migration doit toujours savoir contre quoi elle tourne.
 */
export async function migrate(options) {
    const projectId = requireOption('projectId', options.projectId, 'projectId est requis');
    const apiKey = requireOption('apiKey', options.apiKey, 'apiKey est requis');
    const databaseId = requireOption('databaseId', options.databaseId, 'databaseId est requis — refus de tourner contre une cible implicite');
    const tablesDB = new TablesDB(new Client()
        .setEndpoint(options.endpoint || DEFAULT_ENDPOINT)
        .setProject(projectId)
        .setKey(apiKey));
    return migrateWith({
        tablesDB,
        databaseId,
        migrations: options.migrations,
        ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
        ...(options.log !== undefined ? { log: options.log } : {}),
    });
}
