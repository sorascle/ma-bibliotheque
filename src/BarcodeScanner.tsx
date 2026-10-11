import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type Props = {
  onScan: (code: string) => void;
};

export default function BarcodeScanner({ onScan }: Props) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode("barcode-scanner-box");

    // Drapeau qui suit l'état réel du scanner : a-t-il réussi
    // à démarrer ? Seul le code asynchrone le sait.
    let running = false;
    // Drapeau "le composant a été démonté pendant le démarrage"
    let cancelled = false;

    scanner
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          // Fenêtre allongée : un code-barres est large et bas,
          // il doit tenir ENTIÈREMMENT dans la fenêtre.
          qrbox: { width: 300, height: 120 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          // Le lecteur de codes-barres NATIF du navigateur : bien
          // meilleur que la détection logicielle sur les barres fines.
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        },
        (decodedText) => {
          console.log("Code lu :", decodedText);
          if (!cancelled) onScan(decodedText);
        },
        () => {} // frame sans code lisible : normal, on ignore
      )
      .then(() => {
        if (cancelled) {
          // Démasqué trop tard : le composant est parti pendant
          // le démarrage. On éteint derrière nous.
          scanner.stop().then(() => scanner.clear()).catch(() => {});
        } else {
          running = true;
        }
      })
      .catch(() => {
        setError(
          "Impossible d'accéder à la caméra. Vérifie l'autorisation du navigateur."
        );
      });

    // NETTOYAGE : tolère TOUS les états possibles du scanner.
    return () => {
      cancelled = true;
      if (running) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
      // si pas running : soit le démarrage a échoué (rien à fermer),
      // soit il est en cours (le .then() ci-dessus s'en occupe).
    };
  }, []);

  return (
    <div>
      <div id="barcode-scanner-box" className="w-full max-w-md mx-auto rounded-lg overflow-hidden" />
      {error && (
        <p className="text-red-600 text-sm mt-2 text-center">{error}</p>
      )}
    </div>
  );
}