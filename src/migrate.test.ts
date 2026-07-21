import { describe, it, expect, vi } from 'vitest';
import { migrate, migrateWith, type MigrationsTablesDb } from './migrate.js';
import { MIGRATIONS_TABLE } from './ledger.js';
import { MigrationConfigError, MigrationFailedError, type Migration } from './types.js';

/** Erreur Appwrite minimale : seul `code` est consulté. */
function appwriteError(code: number) {
  return Object.assign(new Error(`appwrite ${code}`), { code });
}

function fakeTablesDb(overrides: Partial<MigrationsTablesDb> = {}): MigrationsTablesDb {
  return {
    get: vi.fn(async () => ({})),
    createTable: vi.fn(async () => {}),
    createVarcharColumn: vi.fn(async () => {}),
    createEnumColumn: vi.fn(async () => {}),
    createDatetimeColumn: vi.fn(async () => {}),
    createIndex: vi.fn(async () => {}),
    getColumn: vi.fn(async () => ({ status: 'available' })),
    listRows: vi.fn(async () => ({ rows: [] })),
    createRow: vi.fn(async (_params: unknown) => ({})),
    ...overrides,
  } as unknown as MigrationsTablesDb;
}

function migration(id: string, onUp?: () => void): Migration {
  return { id, name: id, up: async () => { onUp?.(); } };
}

const validConfig = {
  projectId: 'proj',
  apiKey: 'key',
  databaseId: 'db1',
  migrations: [],
};

describe('migrate — validation de la configuration', () => {
  it('refuse une cible implicite : databaseId vide', async () => {
    const failure = await migrate({ ...validConfig, databaseId: '' }).catch((e) => e);

    expect(failure).toBeInstanceOf(MigrationConfigError);
    expect((failure as MigrationConfigError).option).toBe('databaseId');
  });

  it('refuse un projectId vide', async () => {
    const failure = await migrate({ ...validConfig, projectId: '' }).catch((e) => e);

    expect(failure).toBeInstanceOf(MigrationConfigError);
    expect((failure as MigrationConfigError).option).toBe('projectId');
  });

  it('refuse une apiKey vide', async () => {
    const failure = await migrate({ ...validConfig, apiKey: '' }).catch((e) => e);

    expect(failure).toBeInstanceOf(MigrationConfigError);
    expect((failure as MigrationConfigError).option).toBe('apiKey');
  });
});

describe('migrateWith', () => {
  it('refuse de tourner si la base n\'existe pas, et ne crée rien', async () => {
    const tablesDB = fakeTablesDb({
      get: vi.fn(async () => { throw appwriteError(404); }),
    });

    await expect(
      migrateWith({ tablesDB, databaseId: 'db1', migrations: [], log: () => {} }),
    ).rejects.toThrow(/n'existe pas/);
    expect(tablesDB.createTable).not.toHaveBeenCalled();
  });

  it('relance une erreur d\'accès à la base autre qu\'un 404', async () => {
    const tablesDB = fakeTablesDb({
      get: vi.fn(async () => { throw appwriteError(401); }),
    });

    await expect(
      migrateWith({ tablesDB, databaseId: 'db1', migrations: [], log: () => {} }),
    ).rejects.toThrow(/401/);
  });

  it('provisionne le registre AVANT d\'appliquer les migrations', async () => {
    const events: string[] = [];
    const tablesDB = fakeTablesDb({
      createTable: vi.fn(async (p: { tableId: string }) => { events.push(`table:${p.tableId}`); }),
    });

    await migrateWith({
      tablesDB,
      databaseId: 'db1',
      migrations: [migration('0001_a', () => events.push('up:0001_a'))],
      log: () => {},
    });

    expect(events[0]).toBe(`table:${MIGRATIONS_TABLE}`);
    expect(events).toContain('up:0001_a');
  });

  it('enregistre la migration appliquée dans le registre', async () => {
    const tablesDB = fakeTablesDb();

    const result = await migrateWith({
      tablesDB,
      databaseId: 'db1',
      migrations: [migration('0001_a')],
      log: () => {},
    });

    expect(result.applied.map((m) => m.id)).toEqual(['0001_a']);
    expect(tablesDB.createRow).toHaveBeenCalled();
  });

  it('en dry-run, n\'écrit rien du tout', async () => {
    const tablesDB = fakeTablesDb();

    const result = await migrateWith({
      tablesDB,
      databaseId: 'db1',
      migrations: [migration('0001_a')],
      dryRun: true,
      log: () => {},
    });

    expect(result.applied.map((m) => m.id)).toEqual(['0001_a']);
    expect(tablesDB.createTable).not.toHaveBeenCalled();
    expect(tablesDB.createRow).not.toHaveBeenCalled();
  });

  it('remonte MigrationFailedError en nommant la migration', async () => {
    const tablesDB = fakeTablesDb();
    const boom: Migration = {
      id: '0002_boom',
      name: 'boom',
      up: async () => { throw new Error('colonne invalide'); },
    };

    const failure = await migrateWith({
      tablesDB, databaseId: 'db1', migrations: [boom], log: () => {},
    }).catch((e) => e);

    expect(failure).toBeInstanceOf(MigrationFailedError);
    expect((failure as MigrationFailedError).migrationId).toBe('0002_boom');
  });

  it('journalise par la fonction fournie, jamais par console', async () => {
    const lines: string[] = [];
    const tablesDB = fakeTablesDb();

    await migrateWith({
      tablesDB,
      databaseId: 'db1',
      migrations: [migration('0001_a')],
      log: (m) => lines.push(m),
    });

    expect(lines.join('\n')).toMatch(/0001_a/);
  });
});
