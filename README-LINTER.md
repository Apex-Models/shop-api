# Configuration ESLint, Prettier et Husky

## 🚀 Installation complète

Tous les outils sont déjà installés et configurés dans ce projet :

- **ESLint** : Linter JavaScript/TypeScript
- **Prettier** : Formateur de code
- **Husky** : Hooks Git automatiques
- **lint-staged** : Linter uniquement les fichiers modifiés

## 📋 Scripts disponibles

### Formatting (Prettier)
```bash
npm run format          # Formater tous les fichiers
npm run format:check    # Vérifier le formatage sans modifier
```

### Linting (ESLint)
```bash
npm run lint           # Linter et corriger automatiquement
npm run lint:check     # Linter sans corriger
```

### Automatisation
```bash
npm run lint-staged    # Linter uniquement les fichiers modifiés (utilisé par Husky)
```

## 🔧 Configuration

### ESLint (`eslint.config.js`)
- Configuration optimisée pour Node.js/CommonJS
- Règles permissives pour le développement d'API
- Support TypeScript complet
- Autorise `require()`, `console.log()`, etc.

### Prettier (`.prettierrc.json`)
- Guillemets simples
- Point-virgules obligatoires
- Largeur de ligne : 100 caractères
- Indentation : 2 espaces

### Husky (`.husky/`)
- **pre-commit** : Exécute `lint-staged` avant chaque commit
- **pre-push** : Vérifie le linting et le formatage avant le push

## 🎯 Workflow automatique

1. **Avant chaque commit** : Husky lance automatiquement le linter et prettier sur les fichiers modifiés
2. **Avant chaque push** : Vérification complète du projet
3. **Pendant le développement** : Utilisez `npm run lint` ou `npm run format` manuellement

## 🛠️ Personnalisation

### Désactiver une règle ESLint
Dans `eslint.config.js`, ajoutez ou modifiez dans `rules` :
```javascript
'nom-de-la-regle': 'off'
```

### Ignorer des fichiers
- ESLint : Ajoutez dans la section `ignores` de `eslint.config.js`
- Prettier : Ajoutez dans `.prettierignore`

## ⚡ Conseils

- **Variables non utilisées** : Préfixez par `_` (ex: `_prisma`)
- **Paramètres non utilisés** : Même principe (ex: `_options`)
- **Types any** : Autorisés mais à éviter si possible
- **Console.log** : Autorisé pour le développement d'API

## 🚨 Erreurs courantes

Si ESLint ne trouve pas la configuration :
```bash
# Vérifier que eslint.config.js existe
ls eslint.config.js

# Réinstaller si nécessaire
npm install
```

Si Husky ne fonctionne pas :
```bash
# Réinitialiser Husky
npx husky init
``` 