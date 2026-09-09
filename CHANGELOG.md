# VocabFlash — Historique des versions

## v1.2
Fichiers modifiés : index.html, app.js, sw.js
- Bandeau "Nouvelle version disponible" avec bouton de mise à jour en un tap (le service worker applique la nouvelle version et recharge automatiquement)
- Patch n°1 : correction de la détection des colonnes du lecteur PDF — un mot coupé en plusieurs fragments (ex : "cross" / "-section") n'est plus interprété à tort comme une nouvelle colonne ; la logique se base maintenant sur la taille de l'espace entre les fragments plutôt que sur leur simple présence

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
