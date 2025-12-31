# PocketBase Migrations

## Migration complète du schéma

⚠️ **Important** : Cette migration crée la collection `telegram_users` et met à jour les relations dans `transactions` et `notifications`.

### Option 1 : Import du schéma complet (Recommandé)

1. Accédez à PocketBase Admin UI (`http://localhost:8090/_/`)
2. Allez dans **Settings** → **Import collections**
3. **Copiez tout le contenu** du fichier `pb_schema.json` (racine du projet)
4. **Collez-le** dans la zone de texte de l'interface d'import
5. Cliquez sur **Review** puis **Confirm** pour appliquer les changements

Cette méthode importera:
- ✅ La nouvelle collection `telegram_users`
- ✅ Les relations mises à jour dans `transactions` (pointant vers `telegram_users`)
- ✅ Les relations mises à jour dans `notifications` (pointant vers `telegram_users`)

### Option 2 : Import de la collection seule (Non recommandé)

⚠️ Si vous importez uniquement `telegram_users_collection.json`, vous devrez **manuellement** mettre à jour les relations dans les collections `transactions` et `notifications` pour pointer vers `telegram_users` au lieu de `users`.

1. Accédez à PocketBase Admin UI (`http://localhost:8090/_/`)
2. Allez dans **Collections** → **Import collections**
3. Sélectionnez le fichier `pb_migrations/telegram_users_collection.json`
4. Cliquez sur **Import**
5. ⚠️ **Puis mettez à jour manuellement** :
   - Collection `transactions` → champ `user` → changer la relation vers `telegram_users`
   - Collection `notifications` → champ `user` → changer la relation vers `telegram_users`

### Option 3 : Création manuelle (Non recommandé)

Créez une nouvelle collection avec les paramètres suivants :

**Nom** : `telegram_users`
**Type** : `base` (pas auth)

**Champs** :
- `phone` (text, required)
- `telegram_user_id` (text, required)
- `telegram_chat_id` (text, optional)
- `kyc_status` (select: DRAFT, NOT_STARTED, PENDING, APPROVED, REJECTED)
- `noah_virtual_iban` (text, optional)
- `user_tw_eoa` (text, optional)
- `name` (text, optional)
- `first_name` (text, optional)
- `iban` (text, optional)

**Indexes** :
```sql
CREATE UNIQUE INDEX idx_telegram_user_id ON telegram_users (telegram_user_id)
CREATE INDEX idx_phone ON telegram_users (phone)
CREATE INDEX idx_telegram_chat_id ON telegram_users (telegram_chat_id)
```

**Règles d'accès** :
- List rule: `""` (public)
- View rule: `""` (public)
- Create rule: `""` (public)
- Update rule: `""` (public)
- Delete rule: `null` (aucun)

## Pourquoi `telegram_users` au lieu de `users` ?

La collection `users` par défaut est de type `auth` et nécessite :
- Email obligatoire
- Mot de passe obligatoire (min 8 caractères)
- Authentification admin pour créer des utilisateurs

Notre cas d'usage (Telegram Mini App) n'a pas besoin de ces contraintes, donc nous utilisons une collection `base` simple avec uniquement les champs nécessaires.

## Vérification après import

Après l'import, vérifiez que :
1. ✅ La collection `telegram_users` existe
2. ✅ La collection `transactions` a un champ `user` de type `relation` pointant vers `telegram_users`
3. ✅ La collection `notifications` a un champ `user` de type `relation` pointant vers `telegram_users`
