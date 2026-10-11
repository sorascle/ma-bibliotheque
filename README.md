# 📚 Ma Bibliothèque

Application web de catalogage de livres : scan de codes-barres, recherche par ISBN ou par titre/auteur, fiches détaillées, collection personnelle persistante.

> **Document vivant** — mis à jour à chaque étape du projet. Lisible par tout agent IA ou humain pour reprendre le travail.

## Stack technique

| Élément | Choix | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | Vite comme outil de build |
| Style | Tailwind CSS v4 | via plugin `@tailwindcss/vite`, entrée `src/index.css` (`@import "tailwindcss"`) |
| Scan caméra | html5-qrcode | composant `src/BarcodeScanner.tsx` |
| API données | Open Library | gratuite, sans clé |
| Persistance | localStorage (clé `"collection"`) | locale au navigateur — pas encore synchronisée |

## Lancer le projet

```bash
npm install        # première fois seulement
npm run dev        # serveur de développement → http://localhost:5173
npm run build      # build de production (dossier dist/)
```

## Architecture

```
src/
├── main.tsx           # point d'entrée, importe index.css
├── App.tsx            # états + logique (recherche ISBN, recherche titre,
│                      #   collection, toast) et interface en deux espaces :
│                      #   "Chercher" / "Ma collection" (état `view`)
├── BarcodeScanner.tsx # composant caméra autonome (props : onScan(code))
└── index.css          # entrée Tailwind
```

### Modèle de données

```ts
type Book = { isbn, title, author, year, publisher, pages, coverUrl, subjects, description };
type SearchResult = { key, title, author, year, publisher, coverUrl, isbn };
```

### Appels API Open Library

- **Fiche par ISBN** : `GET /isbn/{isbn}.json` (ISBN-10 ou 13) — l'auteur nécessite une seconde requête via `data.authors[0].key`.
- **Recherche par titre/auteur** : `GET /search.json?q=...&fields=key,title,author_name,first_publish_year,publisher,cover_i,isbn&limit=20` — ⚠️ **le champ `isbn` doit figurer dans `fields`**, sinon l'API ne le renvoie pas (changement de comportement découvert en cours de projet). Résultats filtrés sur ISBN présent, limités à 12.

### Points techniques importants

- `BarcodeScanner` : démarrage caméra asynchrone → nettoyage à 3 états (`running` / `cancelled`) pour survivre au double-montage du StrictMode React.
- L'API évolue sans prévenir : diagnostiquer avec un `fetch` direct dans la Console du navigateur avant de soupçonner son code.
- État = source de vérité ; l'affichage des blocs (liste / fiche / message vide) est piloté par conditions (`mode`, `results.length`, `book`).

## État d'avancement

- ✅ V0 : recherche ISBN → fiche
- ✅ V1 : collection persistante (localStorage), ajout/retrait
- ✅ V1.5 : style Tailwind
- ✅ V2 : scan caméra (EAN-13/QR) + recherche par titre/auteur avec liste de résultats
- ✅ V2.5-a : deux espaces "Chercher" / "Ma collection" + toast de confirmation d'ajout
- ⏭️ V2.5-b : fiches consultables depuis la collection + notes personnelles (champ `personalNote`, migration douce des données existantes)
- ⏭️ V3 : déploiement statique (Vercel/Netlify) → test mobile → backend + stockage cloud

## Limites connues

- Scan EAN-13 capricieux sur webcam Mac (pas de `BarcodeDetector` natif sur Safari) — fiable sur codes larges et sur caméra mobile.
- Collection locale par navigateur : pas de synchronisation multi-appareils (prévu en V3 avec backend).