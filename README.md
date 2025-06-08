
# 🏆 Bot de Mise à Jour des Rangs V.V.V

## 📋 Description

Bot Telegram conçu exclusivement pour le groupe **VEƝI🌿VIƊI🌿VIĆI (V.V.V)** permettant la gestion automatique du classement des quiz et la mise à jour des rangs des participants.

**Développé par:** [@Kageonightray](https://t.me/Kageonightray)

## ✨ Fonctionnalités

### 🎯 Gestion Automatique des Quiz
- Détection automatique des messages de quiz
- Calcul et attribution des points aux participants
- Bonus automatique de 100 points pour les modérateurs
- Mise à jour instantanée du classement

### 🏆 Système de Classement
- 14 catégories de rangs avec emojis distinctifs
- Calcul automatique des positions
- Récompenses automatiques pour certains paliers
- Historique complet des changements

### 📊 Commandes Utilisateur
- `/classement` - Affichage du classement complet
- `/top [n]` - Top N joueurs (défaut: 10)
- `/ma_position [nom]` - Position d'un joueur spécifique
- `/statut` - Informations personnelles de l'utilisateur

### ⚙️ Administration
- Gestion multi-administrateurs
- Système de sauvegardes automatiques
- Historique des modérations
- Restauration de sauvegardes

## 🎮 Catégories de Rangs

| Emoji | Catégorie | Points | Récompense |
|-------|-----------|--------|------------|
| 🔴 | MULADHARA | 90 000 - 100 000 | - |
| 🟠 | SVADHISHTHANA | 80 001 - 90 000 | - |
| 🟡 | MANIPURA | 70 001 - 80 000 | - |
| 🟢 | ANAHATA | 60 001 - 70 000 | - |
| 🔵 | VISHUDDHA | 50 001 - 60 000 | ⭐️ 500 E ⭐️ |
| 💠 | AJNA | 40 001 - 50 000 | - |
| 🟣 | SAHASRARA | 30 001 - 40 000 | ⭐️ 300 E ⭐️ |
| 🔥 | LA COLÈRE | 15 001 - 30 000 | - |
| 🛡 | L'ORGUEIL | 10 001 - 15 000 | - |
| 🔞 | LA LUXURE | 8 001 - 10 000 | - |
| 💰 | L'AVARICE | 6 001 - 8 000 | ⭐️ 150 E ⭐️ |
| 🥇 | L'ENVIE | 4 001 - 6 000 | - |
| 🎂 | LA GOURMANDISE | 2 001 - 4 000 | - |
| ⛱️ | LA PARESSE | 0 - 2 000 | - |

## 🚀 Installation et Déploiement

### Prérequis
- Node.js 18+
- Token de bot Telegram (via [@BotFather](https://t.me/BotFather))

### Variables d'Environnement
```env
TOKEN=votre_token_telegram_bot
SUPER_ADMIN_ID=votre_id_telegram
```

### Installation Locale
```bash
npm install
node index.js
```

### Déploiement sur Replit
1. Forker ce repository
2. Configurer les variables d'environnement dans Replit Secrets
3. Cliquer sur "Run" pour démarrer le bot

## 📝 Format des Quiz

Le bot détecte automatiquement les messages contenant :
- Le mot "quiz" (insensible à la casse)
- Une ligne indiquant le modérateur : `MODO: nom_du_modo`
- Les participants avec leurs points : `@participant_name points`

Exemple :
```
Quiz du jour !
MODO: KageOniGhtray

@Joueur1 150
@Joueur2 120
@Joueur3 100
```

## 🔧 Configuration

### Ajout d'Administrateurs
Seul le super-admin peut ajouter/retirer des administrateurs :
```
/admin add user_id
/admin remove user_id
```

### Initialisation du Classement
```
/set_classement
[Ensuite envoyer le classement au format texte]
```

## 💾 Système de Sauvegarde

- Sauvegarde automatique à chaque mise à jour
- Conservation des sauvegardes pendant 24h
- Restauration possible via `/restaurer nom_fichier`
- Liste des sauvegardes via `/sauvegardes`

## 🛠 Structure du Projet

```
├── index.js           # Fichier principal du bot
├── leaderboard.json   # Données du classement
├── history.json       # Historique des modérations
├── backups/          # Dossier des sauvegardes
├── keep_alive.js     # Système de maintien en vie
└── package.json      # Dépendances Node.js
```

## 📞 Support

Pour toute question ou problème, contacter [@Kageonightray](https://t.me/Kageonightray)

## 📄 Licence

Usage exclusif autorisé pour le groupe V.V.V uniquement.

---

**🌟 VEƝI🌿VIƊI🌿VÍCÍ - V.V.V 🌟**
