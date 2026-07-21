# @crocweb/appwrite-migrations

Moteur de migrations Appwrite **versionnées, forward-only et idempotentes**.

- **Le paquet ne lit jamais l'environnement.** Ni `process.env`, ni
  `process.argv`, ni `.env` : toute la configuration arrive en argument. Aucun
  nom de variable ne vous est imposé.
- **Le paquet ne contient aucune migration.** Vos migrations vivent dans votre
  dépôt, et vous les passez en argument.
- **Forward-only.** Pas de `--down`. Un rollback de schéma sur des données
  réelles est illusoire : supprimer une colonne ne rend pas son contenu. Une
  erreur se corrige par une migration suivante.

## Installation

Le paquet est publié sur **GitHub Packages**, pas sur npmjs.com. Deux lignes
dans le `.npmrc` du projet consommateur :

```ini
@crocweb:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
pnpm add -D @crocweb/appwrite-migrations
```

> ⚠️ **GitHub Packages exige un token même en lecture**, y compris pour un paquet
> issu d'un dépôt public. Il faut donc un PAT avec le scope `read:packages`,
> exposé en `NODE_AUTH_TOKEN` — chez les développeurs, en CI, et dans le build
> Docker (via `--mount=type=secret`, jamais en `COPY`). Le `.npmrc` ci-dessus ne
> contient pas le token lui-même : il le lit dans l'environnement, ce qui le rend
> committable.

**Publication** : elle est déclenchée par un tag `vX.Y.Z` et faite par GitHub
Actions avec le `GITHUB_TOKEN` automatique — aucun token personnel n'intervient.
`dist/` n'est pas versionné : `prepublishOnly` le compile au moment de publier.

`node-appwrite` (>= 22) est une **peerDependency** : c'est votre projet qui le
fournit, donc il n'y en a qu'une copie.

## Usage

Votre point d'entrée, à recopier tel quel :

```ts
// scripts/db/migrate.ts
import 'dotenv/config';
import { migrate } from '@crocweb/appwrite-migrations';
import { migrations } from './migrations/index';

migrate({
  endpoint: process.env.APPWRITE_API_ENDPOINT,
  projectId: process.env.APPWRITE_PROJECT_ID ?? '',
  apiKey: process.env.APPWRITE_API_KEY ?? '',
  databaseId: process.env.APPWRITE_DATABASE_ID ?? '',
  migrations,
  dryRun: process.argv.includes('--dry-run'),
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
```

```json
{ "scripts": { "db:migrate": "tsx scripts/db/migrate.ts" } }
```

```bash
pnpm db:migrate              # applique les migrations en attente
pnpm db:migrate --dry-run    # montre ce qui serait fait, sans rien modifier
```

## Écrire une migration

```ts
// scripts/db/migrations/0001_leads.ts
import type { Migration } from '@crocweb/appwrite-migrations';

const migration: Migration = {
  id: '0001_leads',
  name: 'table quotes : demandes de contact',
  up: async (ctx) => {
    await ctx.ensureTable('quotes', 'Demandes de contact');
    await ctx.ensureVarcharColumn('quotes', 'email', 255, { required: true });
    await ctx.ensureIndex('quotes', 'idx_email', 'unique', ['email']);
  },
};

export default migration;
```

```ts
// scripts/db/migrations/index.ts
import type { Migration } from '@crocweb/appwrite-migrations';
import leads from './0001_leads';

export const migrations: readonly Migration[] = [leads];
```

**N'utilisez que les helpers `ctx.*`.** Ce sont eux qui portent l'idempotence
(absorption du 409 « existe déjà ») et le `dryRun`. Un appel direct au SDK
casse les deux d'un coup — et comme Appwrite n'a pas de transactions, une
migration qui échoue à mi-parcours est **rejouée depuis le début** au
lancement suivant.

L'ordre d'application est celui du **tri sur l'`id`**, jamais celui du tableau.

Appwrite provisionne les colonnes de façon **asynchrone** : créer un index sur
une colonne pas encore `available` échoue par intermittence. `ensureIndex` sonde
`getColumn` jusqu'au statut `available` (délai de garde 30 s) avant de créer
l'index.

## Ce que l'outil ne fait pas

- **Il ne crée jamais la base.** Créez-la une fois dans la console Appwrite
  (Databases → Create database) ; l'outil refuse de tourner si elle manque.
- **Il ne devine jamais la cible.** `databaseId` est obligatoire et sans valeur
  par défaut.
- **Il ne termine jamais le processus.** `migrate` journalise, renvoie son
  résultat et lève en cas d'échec ; le code de sortie vous appartient.

## API

| Export | Rôle |
|---|---|
| `migrate(options)` | Point d'entrée : construit le client Appwrite et applique |
| `migrateWith(options)` | Idem, contre un `TablesDB` que vous fournissez |
| `runMigrations(ctx, ledger, migrations)` | Le moteur nu |
| `createMigrationContext(deps)` | Les helpers idempotents |
| `AppwriteLedger`, `bootstrapLedger` | Le registre persisté (table `migrations`) |
| `MigrationFailedError`, `MigrationConfigError` | Erreurs typées |

## Développement

```bash
pnpm install
pnpm test      # 32 tests, aucun appel réseau
pnpm check     # tsc --noEmit
pnpm build     # dist/
```

Le registre est un **port** (`MigrationLedger`) : en production l'état vit dans
une table Appwrite, en test dans un `Set`. C'est ce qui rend l'ordre,
l'idempotence et le dry-run vérifiables sans réseau.

## Licence

MIT
