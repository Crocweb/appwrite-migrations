import { describe, it, expect, vi } from 'vitest';
import { runMigrations } from './engine.js';
import { MigrationFailedError, type Migration, type MigrationContext, type MigrationLedger } from './types.js';

/** Registre en mémoire — c'est tout l'intérêt d'avoir fait du registre un port. */
function memoryLedger(initial: string[] = []) {
  const ids = new Set(initial);
  const ledger: MigrationLedger = {
    applied: async () => ids,
    record: vi.fn(async (id: string) => { ids.add(id); }),
  };
  return { ledger, ids };
}

function fakeContext(dryRun = false): MigrationContext {
  return {
    databaseId: 'test',
    dryRun,
    ensureTable: vi.fn(async () => {}),
    ensureVarcharColumn: vi.fn(async () => {}),
    ensureEnumColumn: vi.fn(async () => {}),
    ensureDatetimeColumn: vi.fn(async () => {}),
    ensureIndex: vi.fn(async () => {}),
    log: vi.fn(),
  };
}

function migration(id: string, onUp?: () => void): Migration {
  return { id, name: id, up: async () => { onUp?.(); } };
}

describe('runMigrations', () => {
  it('applique dans l\'ordre TRIÉ des id, pas dans l\'ordre du tableau', async () => {
    const order: string[] = [];
    const { ledger } = memoryLedger();

    await runMigrations(fakeContext(), ledger, [
      migration('0003_c', () => order.push('c')),
      migration('0001_a', () => order.push('a')),
      migration('0002_b', () => order.push('b')),
    ]);

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('saute les migrations déjà enregistrées', async () => {
    const ran: string[] = [];
    const { ledger } = memoryLedger(['0001_a']);

    const result = await runMigrations(fakeContext(), ledger, [
      migration('0001_a', () => ran.push('a')),
      migration('0002_b', () => ran.push('b')),
    ]);

    expect(ran).toEqual(['b']);
    expect(result.skipped).toEqual(['0001_a']);
    expect(result.applied.map((m) => m.id)).toEqual(['0002_b']);
  });

  it('est un non-événement quand tout est déjà appliqué', async () => {
    const { ledger } = memoryLedger(['0001_a']);

    const result = await runMigrations(fakeContext(), ledger, [migration('0001_a')]);

    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual(['0001_a']);
  });

  it('en dry-run, exécute la migration mais n\'enregistre RIEN', async () => {
    const ran: string[] = [];
    const { ledger, ids } = memoryLedger();

    const result = await runMigrations(fakeContext(true), ledger, [
      migration('0001_a', () => ran.push('a')),
    ]);

    expect(ran).toEqual(['a']);
    expect(ledger.record).not.toHaveBeenCalled();
    expect(ids.size).toBe(0);
    expect(result.applied.map((m) => m.id)).toEqual(['0001_a']);
  });

  it('s\'arrête à la première migration en échec, en la nommant', async () => {
    const ran: string[] = [];
    const { ledger } = memoryLedger();
    const boom: Migration = {
      id: '0002_boom',
      name: 'boom',
      up: async () => { throw new Error('colonne invalide'); },
    };

    const failure = await runMigrations(fakeContext(), ledger, [
      migration('0001_a', () => ran.push('a')),
      boom,
      migration('0003_c', () => ran.push('c')),
    ]).catch((e) => e);

    expect(failure).toBeInstanceOf(MigrationFailedError);
    expect((failure as MigrationFailedError).migrationId).toBe('0002_boom');
    expect(ran).toEqual(['a']);
  });

  it('n\'enregistre pas une migration qui a échoué — elle sera rejouée', async () => {
    const { ledger, ids } = memoryLedger();
    const boom: Migration = {
      id: '0001_boom',
      name: 'boom',
      up: async () => { throw new Error('boum'); },
    };

    await runMigrations(fakeContext(), ledger, [boom]).catch(() => {});

    expect(ids.has('0001_boom')).toBe(false);
  });
});
