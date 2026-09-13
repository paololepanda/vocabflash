# VocabFlash — Historique des versions

## v1.7
Fichiers modifiés : index.html, app.js, sw.js
- Ajout d'un bouton "Passer à la question suivante" dans le quiz (ne compte ni juste ni faux, montre la bonne réponse puis avance)

## v1.6
Fichiers modifiés : index.html, app.js, sw.js
- Correction majeure de la détection des colonnes PDF : certains PDF encodent l'espace entre les colonnes via un caractère espace à largeur variable (parfois 100+ points) plutôt que par un vrai décalage horizontal — c'était la vraie cause du très faible taux de reconnaissance
- Retrait automatique de la lettre de section collée au premier mot d'un glossaire type dictionnaire (ex : "A acier steel" → "acier steel")
- Plus aucune ligne n'est supprimée silencieusement : toute ligne non comprise apparaît désormais dans l'écran de vérification avec la traduction vide, à compléter à la main
- L'import automatique direct ne se déclenche que si 100% des lignes ont été comprises (au lieu d'un seuil de 70%)

## v1.5
Fichiers modifiés : index.html, app.js, sw.js
- Correction de l'import PDF multi-pages : la détection "texte vs scanné" se fait maintenant page par page (au lieu du document entier), donc un PDF qui mélange des pages avec texte réel et des pages scannées ne perd plus le contenu des pages scannées

## v1.4
Fichiers modifiés : index.html, app.js, sw.js
- Correction du bandeau de mise à jour qui disparaissait tout seul : le service worker forçait l'activation immédiate au lieu d'attendre le tap sur le bouton, ce qui déclenchait un rechargement automatique quasi instantané
- Les underscores "_" (utilisés pour marquer les syllabes accentuées) ne sont plus interprétés comme une coupure de mot par le lecteur

## v1.3
Fichiers modifiés : index.html, app.js, sw.js
- Les paires contenant des symboles de notation (>, <, ≠, ≈, ~, ±) sont désormais exclues automatiquement du quiz et du memory — elles restent stockées mais ne sont plus proposées tant qu'elles ne sont pas corrigées
- Nouvel écran "détail de liste" : depuis "Gérer mes listes", taper sur une liste affiche toutes ses paires ; celles à problème sont surlignées en rouge, avec possibilité de corriger ou supprimer chaque paire

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
