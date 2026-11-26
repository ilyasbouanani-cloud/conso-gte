# Conso GTE — suivi de consommation (électrique vs essence)

Application web installable (PWA), sans compte, sans serveur de données, sans publicité ni statistiques.
Les données restent dans le stockage local de l'iPhone. Technologie : HTML, CSS et JavaScript simples, sans dépendance ni étape de compilation.

## Contenu du dossier
- `index.html`, `css/style.css`, `js/app.js` : l'interface
- `js/calc.js` : les calculs (mêmes formules que le classeur)
- `sw.js` + `manifest.webmanifest` + `icons/` : installation et mode hors connexion

## 1. Essayer sur ton ordinateur
Dans le dossier : `python3 -m http.server 8080`, puis ouvre http://localhost:8080

## 2. La rendre accessible depuis l'iPhone
Safari n'active le mode hors connexion et l'installation « comme une app » que sur une adresse **HTTPS**.
Il faut donc déposer ces fichiers (statiques, sans données) sur un hébergement HTTPS gratuit. Au choix :
- **Netlify Drop** (app.netlify.com/drop) : glisser-déposer le dossier, tu obtiens une adresse en `https://…`
- **GitHub Pages** ou **Cloudflare Pages** : publier le dossier comme site statique

L'hébergeur ne sert que les fichiers de l'application. Tes données ne quittent jamais l'iPhone.
(Une adresse locale en `http://192.168…` permet d'afficher l'app, mais pas de l'utiliser hors connexion.)

## 3. Installer sur l'iPhone
1. Ouvre l'adresse HTTPS dans **Safari**.
2. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Lance l'app **depuis l'icône**. Après une première ouverture avec réseau, elle marche hors connexion.

⚠️ Les données de Safari et celles de l'icône d'écran d'accueil sont séparées : saisis tout depuis l'icône.

## 4. Sauvegarde
Réglages → **Exporter la sauvegarde (.json)** (enregistrer dans Fichiers). **Importer** permet de fusionner ou de remplacer.
Un export `.csv` est aussi disponible pour Excel. Pense à sauvegarder régulièrement : si l'app est supprimée de l'iPhone, les données le sont aussi.

## 5. Mettre à jour l'application
Remplace les fichiers sur l'hébergeur et change `CACHE = 'conso-gte-v1'` en `v2` dans `sw.js`. La nouvelle version s'applique à la 2ᵉ ouverture.

## Calculs (références au classeur « GTE »)
| Calcul | Formule | Cellule |
|---|---|---|
| Km rechargés (maison) | kWh × 31 ÷ 7 | E2 |
| Coût recharge (maison) | €/kWh × kWh | G2 |
| €/100 km (maison, extérieur) | coût × 100 ÷ km | H2, H3 |
| €/kWh (extérieur) | coût ÷ (km ÷ (31/7)) — le 3,8 du classeur est remplacé par 31/7 | F3 |
| €/100 km carburant (référence) | €/L × L/100 km | K2, K3 |
| Durée, minutes, prix (au temps) | kWh ÷ kW ; × 60 ; × €/min | F6, G6, H6 |

Valeurs carburant (SP98, diesel) : fixes, non modifiables.
Ajouts par rapport au classeur : kWh facultatif pour une recharge extérieure, saisie des pleins réels (litres, €/L, km → L/100 km réels), équivalent €/kWh et comparaison « à la maison » dans le simulateur.
Non repris : la cellule B6 (8,4), utilisée par aucune formule.
