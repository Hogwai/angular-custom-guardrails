# no-absolute-scss-url

Checker SCSS autonome qui signale les URL absolues dans les fichiers SCSS :
`url('/assets/...')` (insensible à la casse, `URL(...)`, `Url(...)` inclus),
ainsi que les at-rules de chargement `@import`, `@use` et `@forward` avec un
chemin absolu.

Les URL suivantes sont ignorées : `data:`, `http:`, `https:` (toute casse),
les URL protocol-relative (`//cdn...`) et les fragments (`#`). Les chemins
relatifs (`./x`, `../x`, `x`) sont acceptés.

## Building

Run `nx build no-absolute-scss-url` to build the library. Le binaire est
généré dans `dist/libs/no-absolute-scss-url/src/check.js`.

## Usage CLI

Le binaire accepte des fichiers ou des dossiers (parcourus récursivement,
seuls les `.scss` sont analysés, les doublons sont supprimés) :

```bash
node dist/libs/no-absolute-scss-url/src/check.js path/to/file.scss
node dist/libs/no-absolute-scss-url/src/check.js src/styles
node dist/libs/no-absolute-scss-url/src/check.js file.scss src/styles
```

Le target Nx équivalent est `check` :

```bash
npx nx run no-absolute-scss-url:check
```

Code de sortie :

- `0` : toutes les entrées sont valides ;
- `1` : au moins une violation, une erreur de lecture (chemin inexistant),
  ou aucun argument fourni (l'usage est alors affiché).

## Running unit tests

Run `nx test no-absolute-scss-url` to execute the unit tests via [Vitest](https://vitest.dev/).
