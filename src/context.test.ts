import { describe, it, expect, vi } from 'vitest';
import { createMigrationContext, type TablesDbLike } from './context.js';

/** Erreur Appwrite minimale : seul `code` est consulté. */
function appwriteError(code: number) {
  return Object.assign(new Error(`appwrite ${code}`), { code });
}

function fakeTablesDb(overrides: Partial<TablesDbLike> = {}): TablesDbLike {
  return {
    createTable: vi.fn(async () => {}),
    createVarcharColumn: vi.fn(async () => {}),
    createEnumColumn: vi.fn(async () => {}),
    createDatetimeColumn: vi.fn(async () => {}),
    createIndex: vi.fn(async () => {}),
    getColumn: vi.fn(async () => ({ status: 'available' })),
    ...overrides,
  } as TablesDbLike;
}

function ctxOf(tablesDB: TablesDbLike, dryRun = false) {
  return createMigrationContext({ tablesDB, databaseId: 'db1', dryRun, log: () => {} });
}

describe('createMigrationContext — mode réel', () => {
  it('crée une table avec la bonne cible', async () => {
    const db = fakeTablesDb();
    await ctxOf(db).ensureTable('quotes', 'Demandes');

    expect(db.createTable).toHaveBeenCalledWith({
      databaseId: 'db1',
      tableId: 'quotes',
      name: 'Demandes',
    });
  });

  it('avale un 409 : rejouer une migration est un non-événement', async () => {
    const db = fakeTablesDb({
      createTable: vi.fn(async () => { throw appwriteError(409); }),
    });

    await expect(ctxOf(db).ensureTable('quotes', 'Demandes')).resolves.toBeUndefined();
  });

  it('relance toute autre erreur — un 401 ne doit jamais passer pour un succès', async () => {
    const db = fakeTablesDb({
      createTable: vi.fn(async () => { throw appwriteError(401); }),
    });

    await expect(ctxOf(db).ensureTable('quotes', 'Demandes')).rejects.toThrow(/401/);
  });

  it('crée une colonne varchar avec required par défaut à false', async () => {
    const db = fakeTablesDb();
    await ctxOf(db).ensureVarcharColumn('quotes', 'phone', 32);

    expect(db.createVarcharColumn).toHaveBeenCalledWith({
      databaseId: 'db1', tableId: 'quotes', key: 'phone', size: 32, required: false,
    });
  });

  it('transmet xdefault quand il est fourni', async () => {
    const db = fakeTablesDb();
    await ctxOf(db).ensureEnumColumn('quotes', 'status', ['new', 'read'], { xdefault: 'new' });

    expect(db.createEnumColumn).toHaveBeenCalledWith({
      databaseId: 'db1', tableId: 'quotes', key: 'status',
      elements: ['new', 'read'], required: false, xdefault: 'new',
    });
  });

  it('attend que les colonnes soient disponibles AVANT de créer l\'index', async () => {
    const events: string[] = [];
    const statuses = ['processing', 'processing', 'available'];
    const db = fakeTablesDb({
      getColumn: vi.fn(async () => {
        const status = statuses.shift() ?? 'available';
        events.push(`getColumn:${status}`);
        return { status };
      }),
      createIndex: vi.fn(async () => { events.push('createIndex'); }),
    });

    await ctxOf(db).ensureIndex('quotes', 'idx_email', 'unique', ['email']);

    expect(events).toEqual([
      'getColumn:processing', 'getColumn:processing', 'getColumn:available', 'createIndex',
    ]);
  });

  it('échoue explicitement si une colonne finit en statut failed', async () => {
    const db = fakeTablesDb({ getColumn: vi.fn(async () => ({ status: 'failed' })) });

    await expect(
      ctxOf(db).ensureIndex('quotes', 'idx_email', 'unique', ['email']),
    ).rejects.toThrow(/failed/);
    expect(db.createIndex).not.toHaveBeenCalled();
  });

  it('traduit le type d\'index vers l\'énumération du SDK', async () => {
    const db = fakeTablesDb();
    await ctxOf(db).ensureIndex('quotes', 'idx_email', 'unique', ['email']);

    expect(db.createIndex).toHaveBeenCalledWith({
      databaseId: 'db1', tableId: 'quotes', key: 'idx_email',
      type: 'unique', columns: ['email'],
    });
  });
});

describe('createMigrationContext — dry-run', () => {
  it('n\'appelle AUCUNE méthode du SDK', async () => {
    const db = fakeTablesDb();
    const ctx = ctxOf(db, true);

    await ctx.ensureTable('quotes', 'Demandes');
    await ctx.ensureVarcharColumn('quotes', 'name', 255, { required: true });
    await ctx.ensureEnumColumn('quotes', 'status', ['new'], { xdefault: 'new' });
    await ctx.ensureDatetimeColumn('quotes', 'appliedAt', { required: true });
    await ctx.ensureIndex('quotes', 'idx_email', 'unique', ['email']);

    for (const method of Object.values(db)) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it('journalise ce qui serait fait', async () => {
    const lines: string[] = [];
    const db = fakeTablesDb();
    const ctx = createMigrationContext({
      tablesDB: db, databaseId: 'db1', dryRun: true, log: (m) => lines.push(m),
    });

    await ctx.ensureTable('quotes', 'Demandes');

    expect(lines.join('\n')).toMatch(/quotes/);
  });
});
