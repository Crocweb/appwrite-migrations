import { describe, it, expect, vi } from 'vitest';
import { AppwriteLedger, MIGRATIONS_TABLE, bootstrapLedger, type LedgerTablesDb } from './ledger.js';
import type { MigrationContext } from './types.js';

function rowsPage(ids: string[]) {
  return { rows: ids.map((id, i) => ({ $id: `row-${i}`, migrationId: id })) };
}

describe('AppwriteLedger.applied', () => {
  it('lit les identifiants déjà enregistrés', async () => {
    const tablesDB = {
      listRows: vi.fn(async () => rowsPage(['0001_a', '0002_b'])),
      createRow: vi.fn(async () => ({})),
    } as unknown as LedgerTablesDb;

    const applied = await new AppwriteLedger({ tablesDB, databaseId: 'db1' }).applied();

    expect([...applied].sort()).toEqual(['0001_a', '0002_b']);
    expect(tablesDB.listRows).toHaveBeenCalledOnce();
  });

  it('pagine au-delà d\'une page pleine', async () => {
    const first = rowsPage(Array.from({ length: 100 }, (_, i) => `m${String(i).padStart(3, '0')}`));
    const second = rowsPage(['m100']);
    const listRows = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    const applied = await new AppwriteLedger({
      tablesDB: { listRows, createRow: vi.fn() } as unknown as LedgerTablesDb,
      databaseId: 'db1',
    }).applied();

    expect(applied.size).toBe(101);
    expect(listRows).toHaveBeenCalledTimes(2);
  });

  it('renvoie un ensemble vide si la table n\'existe pas encore (tout premier dry-run)', async () => {
    const notFound = Object.assign(new Error('table introuvable'), { code: 404 });
    const tablesDB = {
      listRows: vi.fn(async () => { throw notFound; }),
      createRow: vi.fn(),
    } as unknown as LedgerTablesDb;

    const applied = await new AppwriteLedger({ tablesDB, databaseId: 'db1' }).applied();

    expect(applied.size).toBe(0);
  });

  it('relance toute autre erreur — un 401 ne doit pas passer pour « rien d\'appliqué »', async () => {
    const unauthorized = Object.assign(new Error('non autorisé'), { code: 401 });
    const tablesDB = {
      listRows: vi.fn(async () => { throw unauthorized; }),
      createRow: vi.fn(),
    } as unknown as LedgerTablesDb;

    await expect(
      new AppwriteLedger({ tablesDB, databaseId: 'db1' }).applied(),
    ).rejects.toThrow(/non autorisé/);
  });
});

describe('AppwriteLedger.record', () => {
  it('écrit une ligne dans la table du registre', async () => {
    // Le faux déclare son paramètre : sans lui, vi.fn infère une signature
    // sans argument et `mock.calls[0]` devient le tuple vide.
    const createRow = vi.fn(async (_params: unknown) => ({}));
    const tablesDB = { listRows: vi.fn(), createRow } as unknown as LedgerTablesDb;

    await new AppwriteLedger({ tablesDB, databaseId: 'db1' }).record('0001_a');

    const arg = createRow.mock.calls[0]![0] as {
      databaseId: string; tableId: string; data: { migrationId: string; appliedAt: string };
    };
    expect(arg.databaseId).toBe('db1');
    expect(arg.tableId).toBe(MIGRATIONS_TABLE);
    expect(arg.data.migrationId).toBe('0001_a');
    expect(() => new Date(arg.data.appliedAt).toISOString()).not.toThrow();
  });
});

describe('bootstrapLedger', () => {
  it('crée la table, ses colonnes et l\'index unique, via le contexte', async () => {
    const ctx = {
      databaseId: 'db1',
      dryRun: false,
      ensureTable: vi.fn(async () => {}),
      ensureVarcharColumn: vi.fn(async () => {}),
      ensureEnumColumn: vi.fn(async () => {}),
      ensureDatetimeColumn: vi.fn(async () => {}),
      ensureIndex: vi.fn(async () => {}),
      log: vi.fn(),
    } as unknown as MigrationContext;

    await bootstrapLedger(ctx);

    expect(ctx.ensureTable).toHaveBeenCalledWith(MIGRATIONS_TABLE, expect.any(String));
    expect(ctx.ensureVarcharColumn).toHaveBeenCalledWith(
      MIGRATIONS_TABLE, 'migrationId', 255, { required: true },
    );
    expect(ctx.ensureDatetimeColumn).toHaveBeenCalledWith(
      MIGRATIONS_TABLE, 'appliedAt', { required: true },
    );
    // L'index UNIQUE est ce qui empêche qu'un incident enregistre deux fois
    // la même migration.
    expect(ctx.ensureIndex).toHaveBeenCalledWith(
      MIGRATIONS_TABLE, 'idx_migration_id', 'unique', ['migrationId'],
    );
  });
});
