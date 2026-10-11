import React, { useState, useEffect } from "react";
import BarcodeScanner from "./BarcodeScanner";

// ============================================================
// MA BIBLIOTHÈQUE — V0 : chercher un livre à partir de son ISBN
// ============================================================

// Type décrivant un livre tel qu'on veut l'utiliser dans NOTRE app.
// Ce n'est pas le format brut de l'API : on le "mappe" (transforme)
// pour ne garder que ce qui nous intéresse.
type Book = {
  isbn: string;
  title: string;
  author: string;
  year: string;
  publisher: string;
  pages: string;
  coverUrl: string | null;
  subjects: string[];
  description: string;
};

// Un résultat de recherche : une fiche résumée par l'API.
// Plus pauvre qu'une fiche complète, mais suffisante pour choisir.
type SearchResult = {
  key: string;          // identifiant unique du doc dans l'API
  title: string;
  author: string;
  year: string;
  publisher: string;
  coverUrl: string | null;
  isbn: string | null;  // pour pouvoir ouvrir la fiche complète ensuite
};

export default function App() {
  // ---- 1. L'ÉTAT DE L'APPLICATION ---------------------------
  const [isbn, setIsbn] = useState(""); // ce que l'utilisateur tape
  const [book, setBook] = useState<Book | null>(null); // le livre trouvé
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [collection, setCollection] = useState<Book[]>(() => {
    // Version "paresseuse" : ce code ne s'exécute qu'une seule
    // fois, au premier rendu. On lit le localStorage, et s'il
    // est vide ou corrompu, on retombe sur un tableau vide.
    try {
      const raw = localStorage.getItem("collection");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return []; // données corrompues → repartir de zéro proprement
    }
  });
  const [scannerOpen, setScannerOpen] = useState(false);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState(""); // le texte tapé dans la recherche
  const [mode, setMode] = useState<"isbn" | "title">("isbn"); // quel onglet
  const [searched, setSearched] = useState(false); // a-t-on déjà cherché ?
  
  // ---- 1 bis. PERSISTANCE -------------------------------
  // useEffect dit à React : "après chaque rendu, SI collection
  // a changé depuis la dernière fois, exécute-moi cette fonction."
  // On déclare UNE FOIS la sauvegarde, et elle s'applique à
  // TOUTES les modifications futures de collection.
  useEffect(() => {
    localStorage.setItem("collection", JSON.stringify(collection));
  }, [collection]); // <- la liste de dépendances : ce qui déclenche

// ---- 2. LA FONCTION QUI APPELLE L'API (Open Library) ----
  async function searchBook(rawIsbn: string) {
    const cleanIsbn = rawIsbn.replace(/[-\s]/g, "");

    if (!/^\d{10}$|^\d{13}$/.test(cleanIsbn)) {
      setStatus("error");
      setErrorMsg("Un ISBN contient 10 ou 13 chiffres (ex. 9782070413119).");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setBook(null);
    setResults([]);

    try {
      // Requête 1 : le livre
      const res = await fetch(
        `https://openlibrary.org/isbn/${cleanIsbn}.json`
      );

      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Aucun livre trouvé pour cet ISBN."
            : `L'API a répondu avec le code ${res.status}.`
        );
      }

      const data = await res.json();

      // Requête 2 : le nom de l'auteur (donnée morcelée, cf. V0)
      let author = "Auteur inconnu";
      if (data.authors?.[0]?.key) {
        const authorRes = await fetch(
          `https://openlibrary.org${data.authors[0].key}.json`
        );
        if (authorRes.ok) {
          const authorData = await authorRes.json();
          author = authorData.name ?? author;
        }
      }

      // description
      const rawDesc = data.description;
      const description =
        typeof rawDesc === "string" ? rawDesc : (rawDesc?.value ?? "");

      const found: Book = {
        isbn: cleanIsbn,
        title: data.title ?? "Titre inconnu",
        author,
        year: data.publish_date ?? "—",
        publisher: data.publishers?.[0] ?? "—",
        pages: data.number_of_pages ? `${data.number_of_pages} pages` : "—",
        coverUrl: data.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`
          : null,
        subjects: data.subjects ?? [],
        description,
      };

      setBook(found);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Une erreur inattendue est survenue."
      );
    }
  }

    // ---- 2 bis. RECHERCHE PAR TITRE/AUTEUR (Open Library, search API) ----
  async function searchByTitle(rawQuery: string) {
    const q = rawQuery.trim();
    if (q.length < 2) {
      setStatus("error");
      setErrorMsg("Tape au moins 2 caractères pour lancer une recherche.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setResults([]);
    setBook(null);
    setSearched(true);

    try {
      // encodeURIComponent : indispensable pour que les espaces et
      // accents d'une recherche soient transmis proprement dans l'URL.
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20`
      );

      if (!res.ok) {
        throw new Error(`L'API a répondu avec le code ${res.status}.`);
      }

      const data = await res.json();
      // On ne garde que les docs qui ont au moins un ISBN :
      // sans ISBN, on ne peut ni ouvrir la fiche, ni l'ajouter — autant ne pas les proposer.
      const withIsbn = data.docs
        .filter((doc: any) => Array.isArray(doc.isbn) && doc.isbn.length > 0)
        .slice(0, 12); // les 12 premiers ayant un ISBN

      // On mappe chaque "doc" vers notre format SearchResult.
      const mapped: SearchResult[] = data.docs.map((doc: any) => ({
        key: doc.key,
        title: doc.title ?? "Titre inconnu",
        author: doc.author_name?.[0] ?? "Auteur inconnu",
        year: doc.first_publish_year ? `${doc.first_publish_year}` : "—",
        publisher: doc.publisher?.[0] ?? "—",
        coverUrl: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg`
          : null,
        isbn: doc.isbn?.[0] ?? null,
      }));

      setResults(mapped);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Une erreur inattendue est survenue."
      );
    }
  }

  // ---- 3. AJOUTER À LA COLLECTION / RETIRER DE LA COLLECTION --------------------------
  function addToCollection(b: Book) {
    if (collection.some((x) => x.isbn === b.isbn)) return; // pas de doublons
    setCollection([...collection, b]);
  }
  function removeFromCollection(isbn: string) {
    // "filter" garde les éléments qui satisfont la condition.
    // Ici : garde tous les livres SAUF celui dont l'isbn correspond.
    setCollection(collection.filter((x) => x.isbn !== isbn));
  }

  // ---- 4. L'INTERFACE ---------------------------------------
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            📚 Ma Bibliothèque
          </h1>
          <p className="text-stone-500 mt-1">
            Scanne, tape un ISBN, ou cherche par titre — et construis ta collection.
          </p>
        </header>

        {/* Bascule entre les deux modes de recherche */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setMode("isbn"); setResults([]); setSearched(false); }}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              mode === "isbn"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
            }`}
          >
            Par ISBN / scan
          </button>
          <button
            onClick={() => { setMode("title"); setBook(null); setSearched(false); }}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              mode === "title"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
            }`}
          >
            Par titre / auteur
          </button>
        </div>

        {/* LE formulaire actif selon le mode — UN SEUL, pas imbriqué */}
        {mode === "isbn" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchBook(isbn);
            }}
            className="flex gap-2"
          >
            <input
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="Ex. 9782070413119"
              className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-amber-400
                         bg-white"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-lg bg-amber-600 px-5 py-2.5 font-medium
                         text-white hover:bg-amber-700 disabled:opacity-50
                         transition-colors"
            >
              {status === "loading" ? "Recherche…" : "Chercher"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchByTitle(query);
            }}
            className="flex gap-2"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex. madame bovary, ou flaubert"
              className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-amber-400
                         bg-white"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-lg bg-amber-600 px-5 py-2.5 font-medium
                         text-white hover:bg-amber-700 disabled:opacity-50
                         transition-colors"
            >
              {status === "loading" ? "Recherche…" : "Chercher"}
            </button>
          </form>
        )}

        {/* Le bouton scanner : uniquement en mode ISBN, HORS du formulaire */}
        {mode === "isbn" && (
          <button
            onClick={() => setScannerOpen(!scannerOpen)}
            className="mt-3 text-sm rounded-lg border border-stone-300 px-3 py-1.5
                       hover:bg-stone-100 transition-colors"
          >
            {scannerOpen ? "✕ Fermer le scanner" : "📷 Scanner un code-barres"}
          </button>
        )}

        {mode === "isbn" && scannerOpen && (
          <BarcodeScanner
            onScan={(code) => {
              setIsbn(code);
              setScannerOpen(false);
              searchBook(code);
            }}
          />
        )}

        {/* Bloc d'erreur — commun aux deux modes, HORS des formulaires */}
        {status === "error" && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            {errorMsg}
          </div>
        )}

        {/* Liste des résultats de recherche par titre */}
        {mode === "title" && results.length > 0 && (
          <section className="mt-6">
            <h2 className="font-semibold mb-3">
              {results.length} résultat{results.length > 1 ? "s" : ""}
            </h2>
            <ul className="grid grid-cols-1 gap-2">
              {results.map((r) => (
                <li
                  key={r.key}
                  className="rounded-lg border border-stone-200 bg-white px-4 py-3
                             flex items-center gap-4"
                >
                  {r.coverUrl ? (
                    <img
                      src={r.coverUrl}
                      alt={`Couverture de ${r.title}`}
                      className="w-10 h-14 object-cover rounded"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded bg-stone-200 flex items-center justify-center">
                      📕
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.title}</p>
                    <p className="text-sm text-stone-500">
                      {r.author} · {r.year} · {r.publisher} · {r.isbn}
                    </p>
                  </div>
                  <button
                    onClick={() => r.isbn && searchBook(r.isbn)}
                    disabled={!r.isbn}
                    className="text-sm rounded-lg border border-stone-300 px-3 py-1.5
                               hover:bg-stone-100 disabled:opacity-40
                               transition-colors"
                    title={r.isbn ? "Ouvrir la fiche complète" : "ISBN indisponible"}
                  >
                    Voir
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Message "aucun résultat" pour la recherche par titre */}
        {mode === "title" && searched && results.length === 0 && status === "idle" && (
          <p className="mt-6 text-stone-500 text-sm">
            Aucun livre trouvé pour « {query} ». Essaie moins de mots, ou
            l'orthographe anglaise du titre.
          </p>
        )}

        {/* La fiche du livre — inchangée */}
        {book && status !== "loading" && (
          <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5 flex gap-5 shadow-sm">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={`Couverture de ${book.title}`}
                className="w-24 h-36 object-cover rounded shadow-md"
              />
            ) : (
              <div className="w-24 h-36 rounded bg-stone-200 flex items-center justify-center text-3xl">
                📕
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{book.title}</h2>
              <p className="text-stone-600 mt-0.5">{book.author}</p>
              <p className="text-sm text-stone-500 mt-2">
                {book.publisher} · {book.year} · {book.pages}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                ISBN {book.isbn}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                Sujets : {book.subjects.length > 0 ? book.subjects.join(", ") : "—"}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Description : {book.description || "—"}
              </p>
              <button
                onClick={() => addToCollection(book)}
                className="mt-3 text-sm rounded-lg border border-stone-300 px-3 py-1.5
                           hover:bg-stone-100 transition-colors"
              >
                + Ajouter à ma collection
              </button>
            </div>
          </div>
        )}

        {/* La collection — inchangée */}
        {collection.length > 0 && (
          <section className="mt-10">
            <h2 className="font-semibold mb-3">
              Ma collection ({collection.length})
            </h2>
            <ul className="grid grid-cols-1 gap-2">
              {collection.map((b) => (
                <li
                  key={b.isbn}
                  className="rounded-lg border border-stone-200 bg-white px-4 py-2.5
                             flex justify-between items-center text-sm gap-3"
                >
                  <span className="font-medium">{b.title}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-stone-500">{b.author}</span>
                    <button
                      onClick={() => removeFromCollection(b.isbn)}
                      className="text-xs text-red-600 border border-red-200
                                 rounded-lg px-2 py-1 hover:bg-red-50
                                 transition-colors"
                    >
                      Retirer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}