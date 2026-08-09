# no-nested-subscribe

Règle ESLint qui interdit de souscrire à un Observable RxJS à l’intérieur d’un
callback de `subscribe`. Les subscriptions imbriquées sont une source de fuites
de mémoire et de comportements non déterministes ; il faut leur préférer un
opérateur de mapping d’ordre supérieur (`switchMap`, `mergeMap`, `concatMap`,
`exhaustMap`).

## Installation dans une application

Copier le dossier `libs/no-nested-subscribe/src` dans l’application, puis
importer directement la règle :

```ts
import { rule as noNestedSubscribe } from './no-nested-subscribe/src';
```

Enregistrer la règle dans une configuration ESLint flat avec le parser
`@typescript-eslint/parser` et l’option `projectService` activée, car la règle
est type-aware (elle vérifie que le receveur de `subscribe` est bien un
Observable RxJS) :

```ts
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: await import('@typescript-eslint/parser'),
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'custom-guardrails': { rules: { 'no-nested-subscribe': noNestedSubscribe } } },
    rules: { 'custom-guardrails/no-nested-subscribe': 'error' },
  },
];
```

## Formes détectées

La règle signale un appel `subscribe` situé dans le corps d’un callback d’un
`subscribe` RxJS vérifié :

- callback inline, flèche ou `function` :

  ```ts
  of(1).subscribe(v => of(2).subscribe(inner => console.log(v, inner)));
  ```

- callback nommé référencé par un identifiant, résolu statiquement vers sa
  `VariableDeclaration` (initialiseur flèche/`function`) ou sa
  `FunctionDeclaration` :

  ```ts
  const callback = () => {
    of(2).subscribe(() => {});
  };
  of(1).subscribe(callback);
  ```

- observer object avec les méthodes `next`, `error` ou `complete`, en notation
  raccourcie, propriété flèche ou `function` :

  ```ts
  of(1).subscribe({
    next: v => of(2).subscribe(inner => console.log(v, inner)),
  });
  ```

- accès statique équivalent `['subscribe']` ; une propriété calculée dynamique
  (`obj[key]`) n’est pas reconnue :

  ```ts
  of(1)['subscribe'](() => {
    of(2).subscribe(() => {});
  });
  ```

- appel `subscribe` sur un objet typé `any` uniquement lorsqu’il est déjà situé
  dans un callback identifié comme appartenant à un `subscribe` RxJS vérifié.

## Cas non signalés (limites intentionnelles)

- Deux subscriptions séquentielles, même sur le même Observable :

  ```ts
  outer$.subscribe(v => console.log(v));
  inner$.subscribe(v => console.log(v));
  ```

- Objets non-RxJS possédant une méthode `subscribe` : la vérification de type
  s’appuie sur le symbole `subscribe` déclaré dans `rxjs`, les faux positifs sur
  des classes ou objets locaux sont exclus.

- Un objet `any` isolé (hors d’un callback identifié) n’est pas considéré comme
  un Observable : `any.subscribe(...)` au niveau racine n’est ni signalé ni
  utilisé pour enregistrer ses callbacks.

- Callbacks non résolubles statiquement : un identifiant qui ne mène pas à une
  déclaration locale flèche/`function` (paramètre, alias indirect,
  observer object stocké dans une variable) n’est pas suivi.

- Appels indirects comme `Observable.prototype.subscribe.call(...)` : hors
  périmètre, car ils ne représentent pas un appel normal.

## Tests

Run `npx nx test no-nested-subscribe` to execute the unit tests via Vitest.
