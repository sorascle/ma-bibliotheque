# 📚 Ma Bibliothèque

Application web de catalogage de livres : scan de codes-barres, recherche par ISBN ou par titre/auteur, fiches détaillées, notes personnelles, collection persistante. **Déployée en ligne sur Cloudflare Pages.**

> **Document vivant** — mis à jour à chaque étape du projet. Lisible par tout agent IA ou humain pour reprendre le travail.

## Stack technique

| Élément | Choix | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | Vite comme outil de build |
| Style | Tailwind CSS v4 | via plugin `@tailwindcss/vite`, entrée `src/index.css` (`@import "tailwindcss"`) |
| Scan caméra | html5-qrcode | composant `src/BarcodeScanner.tsx` |
| API données | Open Library | gratuite, sans clé |
| Persistance | localStorage (clé `"collection"`) | locale au navigateur — pas encore synchronisée (prévu V3) |
| Hébergement | Cloudflare Pages | déploiement continu depuis GitHub |

## Lancer le projet

```bash
npm install        # première fois seulement
npm run dev        # serveur de développement → http://localhost:5173
npm run build      # build de production (dossier dist/) — TOUJOURS vert avant de push
```

## Architecture

```
src/
├── main.tsx           # point d'entrée, importe index.css
├── App.tsx            # états + logique (recherche ISBN, recherche titre,
│                      #   collection, toast, filtre) et interface en deux
│                      #   espaces : "Chercher" / "Ma collection" (état `view`)
└── BarcodeScanner.tsx # composant caméra autonome (props : onScan(code))
```

### Modèle de données

```ts
type Book = { isbn, title, author, year, publisher, pages, coverUrl, subjects, description, personalNote? };
type SearchResult = { key, title, author, year, publisher, coverUrl, isbn };
```

`personalNote` est optionnel : les livres sauvegardés avant son introduction ne l'ont pas (migration douce, lue avec `?? ""`).

### Appels API Open Library

- **Fiche par ISBN** : `GET /isbn/{isbn}.json` (ISBN-10 ou 13) — l'auteur nécessite une seconde requête via `data.authors[0].key`.
- **Recherche par titre/auteur** : `GET /search.json?q=...&fields=key,title,author_name,first_publish_year,publisher,cover_i,isbn&limit=20` — ⚠️ **le champ `isbn` doit figurer dans `fields`**, sinon l'API ne le renvoie pas. Résultats filtrés sur ISBN présent, limités à 12.

### Points techniques importants

- `BarcodeScanner` : démarrage caméra asynchrone → nettoyage à 3 états (`running` / `cancelled`) pour survivre au double-montage du StrictMode React.
- `formatsToSupport` et `experimentalFeatures` existent à l'exécution mais sont **absents des types officiels** de html5-qrcode → type élargi `Html5QrcodeCameraScanConfig & {...}`, importé en **type-only** (`type Html5QrcodeCameraScanConfig`, option `verbatimModuleSyntax` du projet).
- État = source de vérité ; l'affichage des blocs (liste / fiche / message vide) est piloté par conditions (`view`, `mode`, `results.length`, `book`).
- La collection filtrée est un **dérivé** (recalculé à chaque rendu), jamais un état — règle : ne pas stocker ce qui peut se recalculer.
- `npm run build` exécute `tsc -b` (vérification TypeScript stricte) **avant** Vite — le mode dev ne détecte pas ces erreurs. Toujours build en local avant de push.

## Déploiement (Cloudflare Pages)

Le projet est connecté au dépôt GitHub ; **chaque `git push` redéploie automatiquement** (~1-2 min). Statut et logs : dash.cloudflare.com → Workers & Pages → onglet Deployments.

Publier une mise à jour :

```bash
npm run build            # 1. vérifier que le build local est vert
git add .                # 2. sélectionner les changements
git commit -m "..."      # 3. photographier avec un message utile
git push                 # 4. Cloudflare rebuild tout seul
```

En cas d'échec du build distant : lire le log (il nomme fichier + ligne + code d'erreur TS), corriger, rebuild local, re-push. Codes TS déjà rencontrés : TS6133 (import inutilisé), TS2304 (nom introuvable → import manquant), TS2353 (propriété inconnue → élargir le type), TS1484 (import type-only).

## État d'avancement

- ✅ V0 : recherche ISBN → fiche
- ✅ V1 : collection persistante (localStorage), ajout/retrait
- ✅ V1.5 : style Tailwind
- ✅ V2 : scan caméra (EAN-13) + recherche par titre/auteur avec liste de résultats
- ✅ V2.5 : deux espaces "Chercher"/"Ma collection", toast de confirmation, fiches consultables depuis la collection, notes personnelles, badges "déjà en collection", filtre de collection, croix de fermeture de fiche
- ✅ Mise en ligne : Cloudflare Pages, testée sur mobile (scan OK)
- ⏭️ V3 : backend + stockage cloud (synchronisation multi-appareils) — options : Node+SQLite ou Supabase

## Limites connues

- Scan EAN-13 capricieux sur webcam Mac (pas de `BarcodeDetector` natif sur Safari) — fiable sur codes larges et sur caméra mobile.
- Collection locale par navigateur : pas de synchronisation multi-appareils (prévu en V3 avec backend).
- Le toast (vert) ne distingue pas encore succès/retrait — un `toastType` est possible si besoin.