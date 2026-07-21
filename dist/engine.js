import { MigrationFailedError, } from './types.js';
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
export async function runMigrations(ctx, ledger, migrations) {
    const already = await ledger.applied();
    // Tri sur l'id, jamais l'ordre du tableau : sinon un index.ts mal rangé
    // changerait l'ordre d'application.
    const ordered = [...migrations].sort((a, b) => a.id.localeCompare(b.id));
    const applied = [];
    const skipped = [];
    for (const migration of ordered) {
        if (already.has(migration.id)) {
            skipped.push(migration.id);
            continue;
        }
        ctx.log(`${ctx.dryRun ? '· (dry-run) ' : '▶ '}${migration.id} — ${migration.name}`);
        try {
            await migration.up(ctx);
        }
        catch (cause) {
            throw new MigrationFailedError(migration.id, cause);
        }
        if (!ctx.dryRun)
            await ledger.record(migration.id);
        applied.push({ id: migration.id, appliedAt: new Date() });
    }
    return { applied, skipped };
}
