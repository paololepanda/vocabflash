# VocabFlash — Historique des versions

## v1.1
Fichiers modifiés : index.html, app.js, sw.js
- Ajout de l'import de vocabulaire par fichier (PDF texte, PDF scanné avec OCR automatique, TXT, CSV, Word)
- Import automatique direct si la détection est fiable (≥70% des lignes converties en paires), sinon écran de vérification
- Ajout d'un indicateur de version visible en haut de l'appli

## v1.0
Fichiers : index.html, app.js, sw.js, manifest.json, icon-192.png, icon-512.png
- Version initiale : photo → OCR → écran de vérification → liste de vocabulaire
- Quiz de 20 cartes (sens aléatoire, 3 modes de correction : strict / tolérant / choix multiple)
- Jeu de mémoire par paires avec progression automatique par 5
- Gestion des listes par thème + vue globale
