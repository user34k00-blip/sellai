# SellAI — installation et utilisation

Application française Next.js 16, React, TypeScript et Tailwind CSS. Supabase gère les comptes, PostgreSQL et les images privées. OpenAI analyse les photos pour rédiger les annonces et utilise l'image originale comme référence pour la retouche. Les appels et les clés restent côté serveur.

## État du projet

Le build, TypeScript, 15 tests de validation/base de données et 4 tests navigateur ont passé lors de la réalisation. Les tests PostgreSQL exécutent la migration dans PGlite avec un environnement Auth/Storage de test ; ils ne remplacent pas un test sur votre projet Supabase. Les comptes et les générations réelles n'ont pas été testés en ligne faute de clés. Les visuels de `/demo` sont explicitement fictifs et ne sont pas ajoutés aux comptes.

La retouche transmet l'original à l'API d'édition, avec le prompt de préservation fourni et un rendu de 1152 × 2048 pixels. Une IA générative ne garantit pas la conservation parfaite des logos, coutures ou défauts : comparer chaque résultat avant publication. Le site ne publie pas directement sur Vinted. Aucun paiement n'est activé.

## 1. Ouvrir le projet

Dans VS Code : Fichier → Ouvrir un dossier → sélectionner le dossier `sellai` contenant ce README et `package.json`.

Sur l'ordinateur de création, il se trouve dans :

```text
C:\Users\krisb\Documents\Codex\2026-10-02\fait\outputs\sellai
```

Pour une nouvelle installation, installer Node.js 22.12 ou plus récent, puis ouvrir un terminal dans le dossier du projet :

```powershell
npm install
```

Les dépendances sont déjà installées sur l'ordinateur de création. Conserver `package-lock.json`. Pour une installation reproductible ultérieure, utiliser `npm ci`.

## 2. Créer Supabase — comptes, base de données et stockage

1. Ouvrir https://supabase.com/dashboard et créer un compte.
2. Créer un nouveau projet appelé `sellai` dans votre organisation.
3. Choisir une région adaptée aux utilisateurs et un mot de passe de base de données solide. Ce mot de passe n'est pas la clé API.
4. Attendre que le projet soit prêt.
5. Dans le projet, ouvrir **SQL Editor**, puis une nouvelle requête.
6. Ouvrir `supabase/migrations/202610020001_sellai.sql` dans votre éditeur, copier l'intégralité du fichier dans SQL Editor et cliquer sur **Run**.

Exécuter cette migration une seule fois sur un projet vide. Elle crée les tables, les règles d'accès par propriétaire, les fonctions de réservation de génération et les deux buckets privés `originals` et `generated`. Ne pas créer manuellement des buckets publics. Si la migration échoue, corriger l'erreur avant de poursuivre ; ne pas réexécuter arbitrairement des morceaux d'une migration partiellement appliquée.

Vérification : dans Table Editor, les tables `profiles`, `media`, `listings`, `generated_images` et `generation_jobs` existent. Dans Storage, les deux buckets sont privés.

### Alternative avec la CLI Supabase

Si vous utilisez déjà la CLI Supabase :

```powershell
npx supabase login
npx supabase link --project-ref VOTRE_REFERENCE_DE_PROJET
npx supabase db push
```

Choisir soit cette méthode, soit l'exécution manuelle dans SQL Editor pour la première installation. Une migration exécutée manuellement ne s'inscrit pas automatiquement dans l'historique de migrations CLI. Pour les évolutions, créer de nouvelles migrations plutôt que modifier celles déjà appliquées.

## 3. Configurer les clés locales

Créer un fichier **`.env.local`** à la racine du projet, à côté de `package.json`. Le fichier doit s'appeler exactement ainsi, sans suffixe `.txt`. Copier le contenu de `.env.example` puis remplacer les valeurs d'exemple.

```dotenv
APP_URL=http://localhost:3000
SUPABASE_URL=https://VOTRE_PROJET.supabase.co
SUPABASE_ANON_KEY=VOTRE_CLE_PUBLISHABLE
SUPABASE_SERVICE_ROLE_KEY=VOTRE_CLE_SECRET
OPENAI_API_KEY=VOTRE_CLE_OPENAI
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-2
DAILY_LISTING_LIMIT=30
DAILY_IMAGE_LIMIT=5
```

Dans Supabase, le bouton **Connect** fournit l'URL du projet et la clé publishable. **Settings → API Keys** permet de retrouver/créer les clés. Correspondances avec les noms utilisés par SellAI :

| Variable du projet | Valeur Supabase |
| --- | --- |
| `SUPABASE_URL` | Project URL, pas l'URL de la console |
| `SUPABASE_ANON_KEY` | Clé publishable `sb_publishable_...` ; une ancienne clé `anon` est également acceptée |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secret `sb_secret_...` ; une ancienne clé `service_role` est également acceptée |

Les noms de variables restent ceux du projet, même si vous utilisez les nouvelles clés Supabase. La clé secret dispose de privilèges administratifs. Ne partagez pas `.env.local`, ne le publiez pas sur GitHub, ne copiez pas les clés dans un composant React et n'ajoutez pas de préfixe `NEXT_PUBLIC`. `.gitignore` exclut les fichiers de secrets. Pour le premier test des comptes, vous pouvez laisser l'IA non configurée ; les générations ne fonctionneront qu'après l'étape 5.

## 4. Configurer l'inscription et les emails

Dans Supabase → **Authentication → URL Configuration** :

- Site URL : `http://localhost:3000`.
- Redirect URLs : ajouter `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/confirm` et `http://localhost:3000/reset-password`.

Dans les réglages du fournisseur Email, activer l'inscription par email et mot de passe. Laisser la confirmation email activée.

Dans **Authentication → Email Templates**, adapter ces deux liens :

**Confirm sign up** :

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmer mon compte</a>
```

**Reset password** :

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Réinitialiser mon mot de passe</a>
```

Ces liens sont importants : le serveur valide le lien avant de connecter l'utilisateur. Le lien de récupération autorise une seule réinitialisation pendant 15 minutes. Le callback PKCE est aussi pris en charge pour un lien de récupération demandé dans le même navigateur.

Le service email Supabase par défaut est réservé aux essais, avec des restrictions de destinataires et de débit. Pour un premier essai, utiliser une adresse autorisée appartenant à l'équipe du projet. Pour accepter de vrais utilisateurs, configurer un **SMTP personnalisé** dans Supabase avec un fournisseur email, un domaine d'envoi vérifié et les identifiants fournis par ce service. Les identifiants SMTP se configurent dans Supabase, pas dans le navigateur. Tester également la réception des emails de changement d'adresse et de récupération.

## 5. Activer OpenAI — annonces et retouches

1. Ouvrir https://platform.openai.com et créer/sélectionner votre projet API.
2. Configurer la facturation API et vérifier le crédit/budget disponible. La facturation API est distincte d'un abonnement ChatGPT.
3. Créer une clé API pour ce projet, puis la copier dans `OPENAI_API_KEY` de `.env.local`.
4. Vérifier que votre projet a accès à `gpt-4.1-mini` et `gpt-image-2`. Effectuer une vérification d'organisation si votre compte l'exige pour les images.
5. Conserver les deux noms de modèles ci-dessus pour cette version. La retouche est volontairement configurée pour le modèle image qui accepte le format personnalisé 9:16 utilisé par le projet.

Chaque génération réelle consomme l'API du propriétaire de l'installation. Les limites SellAI sont calculées par utilisateur sur les dernières 24 heures et peuvent être abaissées avec les deux variables `DAILY_*`. Le SDK ne relance pas automatiquement les requêtes IA coûteuses en cas d'échec. En cas de réponse réseau perdue, vérifier l'historique avant de relancer une génération.

## 6. Lancer ou redémarrer SellAI

Après modification des clés, redémarrer le serveur. Dans le terminal qui exécute le site, faire **Ctrl+C**, puis :

```powershell
cd "C:\Users\krisb\Documents\Codex\2026-10-02\fait\outputs\sellai"
npm run dev
```

Ouvrir http://localhost:3000 et garder ce terminal ouvert. `localhost` est accessible sur cet ordinateur ; il ne constitue pas une mise en ligne. Le port doit être libre : ne pas lancer deux serveurs simultanément. `APP_URL` doit correspondre exactement à l'adresse utilisée, car le serveur refuse les mutations provenant d'une autre origine.

## 7. Tester le parcours complet

Effectuer les essais dans cet ordre, sur un compte de test :

1. Créer un compte, confirmer l'email puis se connecter. Vérifier la création du profil dans Supabase.
2. Se déconnecter et ouvrir `/dashboard` : le site doit rediriger vers `/login`.
3. Dans Créer une annonce, importer une photo JPG/PNG/WEBP de moins de 4 Mo montrant un seul produit.
4. Ajouter les informations connues et lancer l'analyse. Vérifier que taille, matière et marque inconnues ne sont pas inventées.
5. Modifier le titre et la description, enregistrer, copier et retrouver le résultat dans Mes créations.
6. Envoyer la photo vers Studio Photo IA, lancer la retouche puis comparer les détails avec l'original. Tester le slider, le téléchargement PNG haute qualité et la création d'une annonce à partir du résultat.
7. Recharger la page : les créations doivent rester disponibles.
8. Tester les préférences, le mot de passe oublié et le changement de mot de passe.
9. Créer un deuxième compte de test et vérifier qu'il ne voit pas les créations du premier.
10. Supprimer une création avec confirmation. Tester la suppression du compte uniquement sur un compte de test. Si la suppression est interrompue, `/account-deletion` permet de la reprendre.

Les fichiers trop volumineux, les formats non acceptés et les erreurs IA doivent produire un message français. Les générations peuvent prendre du temps ; attendre le résultat sans répéter les clics.

### Vérifications automatiques

```powershell
npm run typecheck
npm test
npm run build
```

Pour les tests navigateur, démarrer le site dans un premier terminal, puis dans un deuxième :

```powershell
npx playwright install chromium
npm run test:e2e
```

Ces tests automatiques couvrent les règles de base de données, les fichiers, les schémas, les mutations cross-origin, le site public, le thème, le mobile et la protection du dashboard. Ils n'appellent pas une IA réelle et ne prouvent pas que vos clés, votre SMTP ou votre compte fournisseur fonctionnent. Le parcours manuel ci-dessus est nécessaire après configuration.

## 8. Mettre en ligne avec Vercel

Quand tout fonctionne localement :

1. Créer un dépôt GitHub privé avec le contenu du dossier `sellai`, sans `.env.local`, `node_modules`, `.next` ni fichiers de résultats de tests.
2. Dans Vercel, importer ce dépôt. Le framework est Next.js, la commande de build `npm run build` et la commande d'installation `npm ci`.
3. Ajouter les mêmes variables dans les **Environment Variables** Vercel. Définir `APP_URL` sur l'URL HTTPS stable de production, par exemple l'URL `.vercel.app` attribuée à votre projet.
4. Lancer le déploiement. Si l'URL n'était pas connue auparavant, mettre ensuite `APP_URL` à jour et redéployer.
5. Dans Supabase, remplacer le Site URL par cette URL HTTPS et ajouter les trois URLs de retour correspondantes. Les emails utiliseront désormais le domaine de production.
6. Refaire les tests d'inscription, récupération, annonce, retouche, téléchargement et confidentialité sur le site en ligne, sur ordinateur et téléphone.

Les fonctions de génération demandent une durée maximale de 300 secondes ; vérifier les limites du plan d'hébergement et les régler si nécessaire. L'import est limité à 4 Mo pour rester compatible avec les contraintes de corps de requête Vercel. Pour des générations plus longues ou des volumes importants, migrer le traitement vers une file de tâches et un worker, en conservant les règles de réservation existantes.

Pour tester une version de production sur votre ordinateur : arrêter le serveur de développement, exécuter `npm run build`, puis `npm start`.

## 9. Préparer l'ouverture publique — étapes plus avancées

- Configurer SMTP, domaine d'envoi et domaine du site ; tester la délivrabilité des messages.
- Planifier le nettoyage quotidien des uploads abandonnés, tokens expirés et objets en file de suppression. Le script `scripts/cleanup.ts` utilise `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. Dans PowerShell, le lancer avec les variables déjà chargées ou avec Node :

```powershell
node --env-file=.env.local --import tsx scripts/cleanup.ts
```

- Vérifier les quotas, les dépenses API, les alertes et les sauvegardes Supabase. Les échecs de nettoyage restent en file pour être réessayés.
- Préparer les informations de confidentialité et les règles de traitement des photos avec les services externes avant de collecter des données de vrais utilisateurs.
- Effectuer des essais de concurrence, de charge et de reprise après interruption adaptés au volume attendu.
- Ajouter Stripe seulement quand le fonctionnement de base est validé. `credit_balance = null` signifie que la facturation par crédits est désactivée. Un solde entier active la vérification de crédits ; annonce = 1, photo = 5. Le journal est enregistré transactionnellement avec la création. Les offres Pro et Business sont affichées comme futures et ne souscrivent aucun abonnement.

## Architecture

```text
app/                         Pages Next.js, dashboard et routes API
components/                  Navigation, import, annonce, studio, historique, paramètres
lib/ai/                      Intégrations OpenAI et prompts serveur
lib/auth/                    Sessions Supabase et récupération sécurisée
lib/database/                Accès aux profils et créations
lib/storage/                 Validation, réencodage, stockage privé et nettoyage
lib/server/                  Configuration, erreurs et contrôle des requêtes
lib/config.ts                Nom du site, tons, tailles et coûts des générations
lib/schemas.ts               Validation Zod et types partagés
supabase/migrations/         Schéma SQL, permissions, quotas et transactions
scripts/cleanup.ts           Nettoyage administratif
tests/                       Vérifications de validation, SQL et navigateur
```

Pages : `/`, `/pricing`, `/demo`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/dashboard`, `/dashboard/listing-generator`, `/dashboard/photo-studio`, `/dashboard/history`, `/dashboard/settings`, `/account-deletion`.

API : `POST /api/auth/:action`, `POST /api/uploads`, `GET /api/media/:id`, `POST /api/listings/generate`, `GET /api/listings`, `GET/PATCH/DELETE /api/listings/:id`, `POST /api/images/generate`, `GET /api/images`, `GET/DELETE /api/images/:id`, `GET/PATCH/DELETE /api/profile`. L'historique utilise une pagination de 24 créations avec `?offset=`. Le téléchargement utilise `/api/media/:id?download=1`.

L'utilisateur provient d'une session vérifiée côté serveur ; son ID n'est jamais accepté depuis le navigateur. Les tables utilisateur utilisent RLS, les liens entre médias et créations sont contraints au même propriétaire, les fonctions privilégiées sont accessibles seulement au serveur et les requêtes mutantes contrôlent l'origine. Les fichiers sont bornés en taille, décodés avec Sharp puis réencodés en PNG sans EXIF. Un verrou PostgreSQL empêche plusieurs générations/imports simultanés pour un même utilisateur. Les suppressions utilisent une file de nettoyage du stockage et bloquent les nouveaux traitements pendant la suppression du compte.

## Conseils de prix et suivi des photos

La génération d’annonce analyse d’abord le produit, puis lance une recherche web limitée aux annonces Vinted françaises avec le modèle texte OpenAI déjà configuré. Les prix comparables doivent être en euros et corroborés par le prix de l’article dans une page Vinted accessible. Un minimum de trois annonces pertinentes est requis pour proposer un prix conseillé, un prix pour vendre plus vite et un prix d’affichage laissant une marge de négociation. Il s’agit de prix demandés, hors frais de port et protection acheteurs, et non de ventes confirmées. Si les données sont insuffisantes ou la recherche indisponible, le site le signale sans inventer un prix.

Le conseil de prix est affiché pour la génération en cours. Il n’ajoute aucune colonne à Supabase ; une annonce rouverte depuis l’historique peut être régénérée pour rechercher de nouveaux prix. La recherche web et la génération utilisent la facturation API OpenAI du projet.

Les descriptions comportent des sections et des emojis. Les trois mentions « Envoi rapide et soigné », « Réponses rapides aux messages » et « Préparation et envoi filmés » sont sélectionnées par défaut dans le générateur et peuvent être désactivées pour chaque annonce. Aucun délai de livraison précis ou transporteur n’est inventé.

Le studio photo reçoit les étapes du serveur en direct : préparation, génération IA, réception et vérification, puis enregistrement. La barre est animée pendant la génération, car le fournisseur ne donne pas de pourcentage exact. Une première ébauche reçue fait évoluer le message ; le rendu final peut arriver directement sans ébauche. L’état terminé n’est émis qu’une fois la photo enregistrée. La retouche utilise le streaming Images OpenAI et demande une image partielle, également facturée par le fournisseur. En cas de coupure, vérifier l’historique avant de relancer une retouche.

## Références officielles

- [Clés Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
- [Emails et modèles Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)
- [URLs de retour](https://supabase.com/docs/guides/auth/redirect-urls)
- [SMTP personnalisé](https://supabase.com/docs/guides/auth/auth-smtp)
- [Démarrage OpenAI](https://developers.openai.com/api/docs/quickstart)
- [Génération et édition d'images](https://developers.openai.com/api/docs/guides/image-generation)
- [Recherche web OpenAI](https://developers.openai.com/api/docs/guides/tools-web-search)
- [Next.js sur Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
