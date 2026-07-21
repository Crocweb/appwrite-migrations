/**
 * Contrats du moteur de migrations Appwrite.
 *
 * Porté depuis ez-coach (packages/kernel/adapters-appwrite), traduit du
 * vocabulaire collections/documents/attributes vers tables/rows/columns —
 * `Databases` est déprécié depuis Appwrite 1.8.0 au profit de `TablesDB`.
 */
export class MigrationFailedError extends Error {
    migrationId;
    constructor(migrationId, cause) {
        super(`migration "${migrationId}" échouée : ${String(cause)}`, { cause });
        this.name = 'MigrationFailedError';
        this.migrationId = migrationId;
    }
}
/**
 * Configuration invalide : option obligatoire vide.
 *
 * Distincte de `MigrationFailedError` : rien n'a été tenté, aucun appel réseau
 * n'a eu lieu, et l'appelant n'a pas à se demander si le schéma est partiel.
 */
export class MigrationConfigError extends Error {
    option;
    constructor(option, message) {
        super(message);
        this.name = 'MigrationConfigError';
        this.option = option;
    }
}
