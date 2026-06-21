# Calculateur de congés annuels & RTT — DRH

Application web moderne reprenant le tableur Excel de la DRH pour estimer, pour
un agent, le nombre de jours de repos (congés annuels + RTT) sur une période
donnée.

Refonte de l'outil Excel en application **réactive, intuitive et dynamique** :
- recalcul instantané à chaque saisie ;
- **Tableau de bord** d'accueil : 5 indicateurs clés + 4 graphiques (donut & barres) ;
- valeurs animées et fiche imprimable / exportable en PDF ;
- navigation en **sidebar** : **Tableau de bord**, **Calculateur**, **Départ de l'agent**, **Annualisation**, **Barème**, **Notice** ;
- saisie mémorisée localement (localStorage), aucun envoi de données.

Le moteur de calcul reproduit **fidèlement** le classeur Excel de la DRH
(feuilles « Calculateur » et « Barèmes ») et la méthode d'annualisation des
centres de gestion (cahier des charges DRH).

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + composants **shadcn/ui** (thème de marque)
- [Recharts](https://recharts.org/) pour les graphiques du tableau de bord
- [lucide-react](https://lucide.dev/) pour les icônes

## Démarrer

```bash
npm install
npm run dev      # serveur de dev : http://localhost:5173
```

## Construire

```bash
npm run build    # génère dist/ (chemins relatifs)
npm run preview  # prévisualise le build
```

Le build utilise `base: './'` : le fichier `dist/index.html` s'ouvre
directement par double-clic (sans serveur) et fonctionne aussi derrière
n'importe quel sous-dossier (intranet, Vercel, etc.).

## Logique de calcul

Cf. `src/lib/calc.ts` et l'onglet **Notice** de l'application.

| Élément | Formule |
|---|---|
| Prorata | jours calendaires de la période ÷ 365 |
| Congés annuels (CA) | 25 × quotité × prorata (arrondi à l'entier le plus proche, 0,5 → sup.) |
| RTT proratisés | barème (socle × quotité) de la table « Barèmes » × prorata (arrondi entier) |
| RTT réelles | RTT × (jours ouvrés − maladie) ÷ jours ouvrés (prorata maladie, arrondi entier) |
| Journée de solidarité | 1 jour à effectuer — **non déduit** du total (information) |
| **Total** | CA + RTT réelles |

### Volet « Départ de l'agent »

| Élément | Formule |
|---|---|
| Solde de congés payés | CA acquis − congés déjà pris |
| Jours indemnisables | min(max(0, solde), 20 × quotité) — plafond 4 semaines |
| Indemnité par jour | (rémunération mensuelle brute × 12) ÷ 250 |
| Montant à payer (brut) | jours indemnisables × indemnité par jour |

> Indemnisation des congés non pris : décret n° 2025-564, en fin de relation de travail.

### Volet « Annualisation »

Pour les agents dont le temps de travail est réparti sur l'année (planning
variable). Méthode des centres de gestion : un temps plein = **1607 h/an**.

| Élément | Formule |
|---|---|
| Heures annuelles (X) | heures hebdo × nombre de semaines travaillées |
| Équivalent hebdomadaire annualisé | (X × 35) ÷ 1607 |
| Quotité de paie | X ÷ 1607 |
| Congés annuels | 25 × quotité × prorata (jours ouvrés, arrondi 0,5) |
| RTT / ARTT | **0** — les agents annualisés n'ouvrent pas de RTT |

> Exemple ATSEM (CDG27) : 20 h × 36 semaines → X = 720 h · équivalent **15,68 h/sem** ·
> quotité **44,8 %** · **11 j** de congés.

### Exemple de référence (identique au classeur)

Socle 38 h · 100 % · 01/01/2026 → 31/12/2026 · 0 maladie
→ 365 j calendaires · prorata 100 % · CA 25 · RTT 18 → **Total = 43 jours**.
Départ avec 2 400 € brut → indemnité **115,20 €/j** · 20 j → **2 304 € brut**.

> Outil d'estimation indicatif. En cas de situation particulière, la DRH
> reste l'unique référence.
