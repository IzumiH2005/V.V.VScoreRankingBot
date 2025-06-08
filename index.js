
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { keepAlive, startPinging } = require('./keep_alive');

// ===================== CONFIGURATION INITIALE =====================
const TOKEN = '7270945234:AAHoVIFelsK-1CPCB2jF1YZKdh7T0LUiEig';
const SUPER_ADMIN_ID = 6419892672;
const LEADERBOARD_FILE = 'leaderboard.json';
const HISTORY_FILE = 'history.json';
const BACKUP_DIR = 'backups';
const bot = new TelegramBot(TOKEN, {polling: true});

// Créer le dossier de sauvegarde s'il n'existe pas
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

// Structure des catégories de rang
const CATEGORIES = [
    { name: "MULADHARA", min: 90000, max: 100000, emoji: "🔴", reward: null },
    { name: "SVADHISHTHANA", min: 80001, max: 90000, emoji: "🟠", reward: null },
    { name: "MANIPURA", min: 70001, max: 80000, emoji: "🟡", reward: null },
    { name: "ANAHATA", min: 60001, max: 70000, emoji: "🟢", reward: null },
    { name: "VISHUDDHA", min: 50001, max: 60000, emoji: "🔵", reward: "⭐️ RÉCOMPENSE : 500 E ⭐️" },
    { name: "AJNA", min: 40001, max: 50000, emoji: "💠", reward: null },
    { name: "SAHASRARA", min: 30001, max: 40000, emoji: "🟣", reward: "⭐️ RÉCOMPENSE : 300 E ⭐️" },
    { name: "LA COLÉRE", min: 15001, max: 30000, emoji: "🔥", reward: null },
    { name: "L' ORGUEIL", min: 10001, max: 15000, emoji: "🛡", reward: null },
    { name: "LA LUXURE", min: 8001, max: 10000, emoji: "🔞", reward: null },
    { name: "L' AVARICE", min: 6001, max: 8000, emoji: "💰", reward: "⭐️ RÉCOMPENSE : 150 E ⭐️\n[sauf pour ceux déjà passé par la]" },
    { name: "L' ENVIE", min: 4001, max: 6000, emoji: "🥇", reward: null },
    { name: "LA GOURMANDISE", min: 2001, max: 4000, emoji: "🎂", reward: null },
    { name: "LA PARESSE", min: 0, max: 2000, emoji: "⛱️", reward: null }
];

// ===================== MODULE DE STOCKAGE =====================
const storage = {
    admins: new Set([SUPER_ADMIN_ID]),
    leaderboard: { players: [] },
    history: [],

    loadData() {
        try {
            if (fs.existsSync(LEADERBOARD_FILE)) {
                this.leaderboard = JSON.parse(fs.readFileSync(LEADERBOARD_FILE));
            }
            if (fs.existsSync(HISTORY_FILE)) {
                this.history = JSON.parse(fs.readFileSync(HISTORY_FILE));
            }
        } catch (e) {
            console.error('Erreur de chargement des données:', e);
        }
    },

    saveData() {
        try {
            fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(this.leaderboard, null, 2));
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2));
        } catch (e) {
            console.error('Erreur de sauvegarde des données:', e);
        }
    },

    createBackup() {
        try {
            const timestamp = moment().format('YYYYMMDD_HHmmss');
            const backupFile = path.join(BACKUP_DIR, `leaderboard_${timestamp}.json`);
            fs.copyFileSync(LEADERBOARD_FILE, backupFile);
            console.log(`Sauvegarde créée: ${backupFile}`);
        } catch (e) {
            console.error('Erreur de création de sauvegarde:', e);
        }
    },

    cleanOldBackups() {
        try {
            const files = fs.readdirSync(BACKUP_DIR);
            const now = moment();
            
            files.forEach(file => {
                if (file.startsWith('leaderboard_') && file.endsWith('.json')) {
                    const fileDate = moment(file.replace('leaderboard_', '').replace('.json', ''), 'YYYYMMDD_HHmmss');
                    if (now.diff(fileDate, 'hours') > 24) {
                        fs.unlinkSync(path.join(BACKUP_DIR, file));
                        console.log(`Sauvegarde expirée supprimée: ${file}`);
                    }
                }
            });
        } catch (e) {
            console.error('Erreur de nettoyage des sauvegardes:', e);
        }
    },

    getBackups() {
        try {
            return fs.readdirSync(BACKUP_DIR)
                .filter(file => file.startsWith('leaderboard_') && file.endsWith('.json'))
                .map(file => ({
                    filename: file,
                    timestamp: moment(file.replace('leaderboard_', '').replace('.json', ''), 'YYYYMMDD_HHmmss').format('LLL')
                }));
        } catch (e) {
            console.error('Erreur de liste des sauvegardes:', e);
            return [];
        }
    },

    restoreBackup(filename) {
        try {
            const backupFile = path.join(BACKUP_DIR, filename);
            if (fs.existsSync(backupFile)) {
                const backupData = JSON.parse(fs.readFileSync(backupFile));
                this.leaderboard = backupData;
                this.saveData();
                return true;
            }
            return false;
        } catch (e) {
            console.error('Erreur de restauration:', e);
            return false;
        }
    },

    addAdmin(userId) {
        this.admins.add(Number(userId));
        return `✅ Administrateur ${userId} ajouté`;
    },

    removeAdmin(userId) {
        this.admins.delete(Number(userId));
        return `❌ Administrateur ${userId} supprimé`;
    },

    isAdmin(userId) {
        return this.admins.has(Number(userId));
    },

    recordModeration(modo, quizId, date) {
        this.history.push({ modo, quizId, date });
        this.saveData();
    },

    getModoHistory() {
        return this.history;
    }
};

// ===================== MODULE DE PARSING =====================
const parser = {
    parseQuizText(text) {
        const lines = text.split('\n');
        const result = { modo: null, participants: [], rubriques: [], modePoints: null };
        
        // Détection du modérateur dans tous les formats possibles
        for (const line of lines) {
            // Format avec points explicites: "MODO: NOM 250"
            const modoWithPointsMatch = line.match(/(?:MODO|MODÉRATEUR)\s*[:=]?\s*(.+?)\s+(\d+)/i);
            if (modoWithPointsMatch) {
                result.modo = modoWithPointsMatch[1].trim();
                result.modePoints = parseInt(modoWithPointsMatch[2]);
                break;
            }
            
            // Format avec emoji: ⚔️ MODO : nom ⚔️ (supports Unicode)
            const modoEmojiMatch = line.match(/⚔️\s*(?:MODO|MODÉRATEUR|𝗠𝗢𝗗𝗢|𝐌𝐎𝐃𝐎|𝑴𝑶𝑫𝑶|𝙼𝙾𝙳𝙾)\s*[:=]?\s*(.+?)\s*⚔️/i);
            if (modoEmojiMatch) {
                result.modo = modoEmojiMatch[1].trim();
                break;
            }
            
            // Format standard: MODO : nom ou MODO nom (même ligne) (supports Unicode)
            const modoStandardMatch = line.match(/(?:MODO|MODÉRATEUR|𝗠𝗢𝗗𝗢|𝐌𝐎𝐃𝐎|𝑴𝑶𝑫𝑶|𝙼𝙾𝙳𝙾)\s*[:=]?\s*(.+)/i);
            if (modoStandardMatch) {
                // Nettoyer le nom du modo en supprimant les caractères spéciaux de fin
                let modoName = modoStandardMatch[1].trim();
                // Supprimer les emojis et caractères spéciaux à la fin
                modoName = modoName.replace(/[⚔️🛡🔥💰🎯]+\s*$/, '').trim();
                result.modo = modoName;
                break;
            }
        }
        
        // Détection des rubriques (si pas de points explicites pour le modo)
        if (result.modePoints === null) {
            const rubriquePatterns = [
                // Patterns avec nombre de questions
                /^(ANAGRAMMES?)\s*(\d+)\s*Q?/i,
                /^(CAPITAL\s*PAYS?)\s*(\d+)\s*Q?/i,
                /^(VAURIEN)\s*(\d+)\s*Q?/i,
                /^(LP)\s*(\d+)\s*Q?/i,
                /^(CULTURE\s*G)\s*(\d+)\s*Q?/i,
                /^(HISTOIRE)\s*(\d+)\s*Q?/i,
                /^(GEOGRAPHIE)\s*(\d+)\s*Q?/i,
                /^(SPORT)\s*(\d+)\s*Q?/i,
                /^(SCIENCE)\s*(\d+)\s*Q?/i,
                /^(CINEMA)\s*(\d+)\s*Q?/i,
                /^(MUSIQUE)\s*(\d+)\s*Q?/i,
                /^([A-Z\s]+)\s*(\d+)\s*Q/i, // Pattern générique avec nombre
                
                // Patterns sans nombre de questions (détection améliorée)
                /^(ANAGRAMMES?)$/i,
                /^(ID)$/i,
                /^(CAPITAL\s*PAYS?)$/i,
                /^(VAURIEN)$/i,
                /^(LP)$/i,
                /^(CULTURE\s*G)$/i,
                /^(HISTOIRE)$/i,
                /^(GEOGRAPHIE)$/i,
                /^(SPORT)$/i,
                /^(SCIENCE)$/i,
                /^(CINEMA)$/i,
                /^(MUSIQUE)$/i,
                
                // Pattern spécial pour ID avec ou sans nombre
                /^(ID)\s*(\d+)?$/i
            ];
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Ignorer les lignes vides ou trop courtes
                if (!trimmedLine || trimmedLine.length < 2) continue;
                
                for (const pattern of rubriquePatterns) {
                    const match = trimmedLine.match(pattern);
                    if (match) {
                        const rubrique = match[1].trim();
                        const nbQuestions = match[2] ? parseInt(match[2]) : 1;
                        
                        // Éviter les doublons
                        if (!result.rubriques.find(r => r.name.toLowerCase() === rubrique.toLowerCase())) {
                            result.rubriques.push({ name: rubrique, questions: nbQuestions });
                        }
                        break;
                    }
                }
            }
        }
        
        // Créer une liste des noms de rubriques détectées pour éviter les doublons
        const rubriqueNames = result.rubriques.map(r => r.name.toLowerCase());
        
        // Détection des participants (format standard et format avec emojis)
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Ignorer les lignes qui correspondent à des rubriques déjà détectées
            let isRubrique = false;
            for (const rubrique of result.rubriques) {
                const rubriquePattern = new RegExp(`^${rubrique.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\d*\\s*Q?\\s*$`, 'i');
                if (rubriquePattern.test(trimmedLine)) {
                    isRubrique = true;
                    break;
                }
            }
            
            // Si c'est une rubrique, ignorer cette ligne
            if (isRubrique) continue;
            
            // Format standard : @nom points ou nom points
            let participantMatch = line.match(/(?:@)?([\w\sÀ-ÿ'-]+)\s+(\d+)/i);
            
            // Format avec emojis : 🛡 - nom points ou ⚔️ - nom points
            if (!participantMatch) {
                participantMatch = line.match(/(?:🛡|⚔️)\s*-\s*([\w\sÀ-ÿ'-]+)\s+(\d+)/i);
            }
            
            if (participantMatch) {
                const rawName = participantMatch[1].trim();
                const points = parseInt(participantMatch[2]);
                
                // Vérifier que ce n'est pas une rubrique mal détectée
                const isRubriqueMatch = rubriqueNames.some(rubName => 
                    rawName.toLowerCase().includes(rubName) || rubName.includes(rawName.toLowerCase())
                );
                
                // Éviter les noms vides, invalides ou correspondant à des rubriques
                if (rawName && !isNaN(points) && points > 0 && !isRubriqueMatch) {
                    // Conserver le nom tel quel pour préserver la casse originale
                    result.participants.push({ name: rawName, points });
                }
            }
        }
        
        return result;
    },

    parseLeaderboardText(text) {
        const lines = text.split('\n');
        const players = [];
        let currentCategory = null;
        
        for (const line of lines) {
            // Détection des catégories (format original)
            const categoryMatch = line.match(/^([🔴🟠🟡🟢🔵💠🟣🔥🛡🔞💰🥇🎂⛱️])\s*([\w\sÀ-ÿ'-]+)\s*\[([\d\s-]+)P?\]/i);
            if (categoryMatch) {
                currentCategory = categoryMatch[2].trim();
                continue;
            }
            
            // Détection des joueurs (format original)
            const playerMatch = line.match(/-(\d+)-?\s+([\d\s]+)\s*-\s*([\w\sÀ-ÿ'-]+)/i);
            if (playerMatch && currentCategory) {
                const rank = parseInt(playerMatch[1]);
                const points = parseInt(playerMatch[2].replace(/\s/g, ''));
                const name = playerMatch[3].trim();
                
                players.push({
                    name,
                    points,
                    rank,
                    category: currentCategory,
                    joinDate: new Date().toISOString()
                });
                continue;
            }
            
            // Nouveau format: "1. SYD + 50 561" ou "10. YUMI – DARK 🕷 + 10 470"
            const newFormatMatch = line.match(/^(\d+)\.\s+(.*?)\s*[+–-]\s*([\d\s]+)$/);
            if (newFormatMatch) {
                const rank = parseInt(newFormatMatch[1]);
                const name = newFormatMatch[2].trim().toUpperCase();
                const points = parseInt(newFormatMatch[3].replace(/\s/g, ''));
                
                players.push({
                    name,
                    points,
                    rank,
                    category: null, // Sera assignée automatiquement
                    joinDate: new Date().toISOString()
                });
            }
        }
        
        return players;
    }
};

// ===================== MODULE DE CLASSEMENT =====================
const leaderboard = {
    findPlayer(name) {
        const trimmedName = name.trim();
        const normalizedName = trimmedName.toUpperCase();
        
        // Chercher d'abord une correspondance exacte
        let player = storage.leaderboard.players.find(p => p.name === trimmedName);
        
        // Si pas trouvé, chercher en ignorant la casse
        if (!player) {
            player = storage.leaderboard.players.find(p => p.name.toUpperCase() === normalizedName);
        }
        
        return player;
    },

    addPointsToPlayer(name, points) {
        // Normaliser le nom (trim et uppercase pour uniformité)
        const normalizedName = name.trim().toUpperCase();
        
        // Chercher d'abord une correspondance exacte (sensible à la casse)
        let player = storage.leaderboard.players.find(p => p.name === name.trim());
        
        // Si pas trouvé, chercher en ignorant la casse
        if (!player) {
            player = storage.leaderboard.players.find(p => p.name.toUpperCase() === normalizedName);
        }
        
        if (player) {
            // Joueur existant trouvé - ajouter les points
            player.points += points;
            console.log(`Points ajoutés à ${player.name}: +${points} (total: ${player.points})`);
        } else {
            // Nouveau joueur - utiliser le nom normalisé
            const newPlayer = {
                name: normalizedName,
                points,
                joinDate: new Date().toISOString()
            };
            storage.leaderboard.players.push(newPlayer);
            console.log(`Nouveau joueur créé: ${normalizedName} avec ${points} points`);
        }
    },

    addModeratorBonus(modoName, points) {
        if (modoName && points > 0) {
            this.addPointsToPlayer(modoName.toUpperCase(), points);
            return `⭐ Bonus de ${points} points ajouté à ${modoName}`;
        }
        return null;
    },

    sortLeaderboard() {
        storage.leaderboard.players.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return new Date(a.joinDate) - new Date(b.joinDate);
        });
    },

    assignRanks() {
        this.sortLeaderboard();
        storage.leaderboard.players.forEach((player, index) => {
            player.rank = index + 1;
            player.category = this.getCategory(player.points);
        });
    },

    getCategory(points) {
        return CATEGORIES.find(cat => points >= cat.min && points <= cat.max);
    },

    updateLeaderboard(quizData, quizId, date) {
        const changes = [];
        
        // Ajouter les participants
        quizData.participants.forEach(({ name, points }) => {
            const before = this.findPlayer(name)?.points || 0;
            this.addPointsToPlayer(name, points);
            const after = before + points;
            changes.push({ name, before, after });
        });
        
        // Ajouter le bonus modo
        let modoPoints = 0;
        if (quizData.modePoints !== null) {
            // Points explicites dans le quiz
            modoPoints = quizData.modePoints;
        } else if (quizData.rubriques.length > 0) {
            // Calcul automatique : 50 points par rubrique
            modoPoints = quizData.rubriques.length * 50;
        }
        
        const modoBonus = this.addModeratorBonus(quizData.modo, modoPoints);
        if (modoBonus) changes.push(modoBonus);
        
        // Mettre à jour les rangs
        this.assignRanks();
        
        // Enregistrer l'historique
        if (quizData.modo) {
            storage.recordModeration(quizData.modo, quizId, date);
        }
        
        // Sauvegarder et créer une sauvegarde
        storage.saveData();
        storage.createBackup();
        storage.cleanOldBackups();
        
        return changes;
    },

    setLeaderboardData(players) {
        storage.leaderboard.players = players;
        this.assignRanks();
        storage.saveData();
        storage.createBackup();
        return true;
    }
};

// ===================== MODULE DE DÉTECTION DE DOUBLONS =====================
const duplicateDetector = {
    // Calcule la distance de Levenshtein entre deux chaînes
    levenshteinDistance(str1, str2) {
        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;

        for (let i = 0; i <= len2; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len1; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len2; i++) {
            for (let j = 1; j <= len1; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[len2][len1];
    },

    // Calcule le pourcentage de similarité entre deux chaînes
    calculateSimilarity(str1, str2) {
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 100;
        
        const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
        return ((maxLength - distance) / maxLength) * 100;
    },

    // Vérifie si un nom est contenu dans un autre
    isSubstring(str1, str2) {
        const lower1 = str1.toLowerCase();
        const lower2 = str2.toLowerCase();
        return lower1.includes(lower2) || lower2.includes(lower1);
    },

    // Vérifie si deux noms partagent un préfixe/suffixe commun
    hasCommonPrefixSuffix(str1, str2, minLength = 3) {
        const lower1 = str1.toLowerCase();
        const lower2 = str2.toLowerCase();
        
        // Préfixe commun
        let prefixLength = 0;
        for (let i = 0; i < Math.min(lower1.length, lower2.length); i++) {
            if (lower1[i] === lower2[i]) {
                prefixLength++;
            } else {
                break;
            }
        }
        
        // Suffixe commun
        let suffixLength = 0;
        for (let i = 1; i <= Math.min(lower1.length, lower2.length); i++) {
            if (lower1[lower1.length - i] === lower2[lower2.length - i]) {
                suffixLength++;
            } else {
                break;
            }
        }
        
        return prefixLength >= minLength || suffixLength >= minLength;
    },

    // Normalise un nom (supprime les caractères spéciaux, espaces, etc.)
    normalizeName(name) {
        return name.replace(/[^a-zA-Z0-9À-ÿ]/g, '').toLowerCase();
    },

    // Détecte les doublons potentiels dans la liste des joueurs
    detectDuplicates() {
        const players = storage.leaderboard.players;
        const duplicateGroups = [];
        const processed = new Set();

        for (let i = 0; i < players.length; i++) {
            if (processed.has(i)) continue;
            
            const currentPlayer = players[i];
            const currentName = currentPlayer.name;
            const normalizedCurrent = this.normalizeName(currentName);
            
            const similarPlayers = [currentPlayer];
            
            for (let j = i + 1; j < players.length; j++) {
                if (processed.has(j)) continue;
                
                const otherPlayer = players[j];
                const otherName = otherPlayer.name;
                const normalizedOther = this.normalizeName(otherName);
                
                // Critères de similarité
                const similarity = this.calculateSimilarity(normalizedCurrent, normalizedOther);
                const isSubstr = this.isSubstring(currentName, otherName);
                const hasCommonPart = this.hasCommonPrefixSuffix(normalizedCurrent, normalizedOther);
                
                // Seuils de détection
                const isSimilar = similarity >= 70 || // 70% de similarité
                                 isSubstr || // Un nom contient l'autre
                                 hasCommonPart || // Préfixe/suffixe commun
                                 normalizedCurrent === normalizedOther; // Identiques après normalisation
                
                if (isSimilar) {
                    similarPlayers.push(otherPlayer);
                    processed.add(j);
                }
            }
            
            if (similarPlayers.length > 1) {
                duplicateGroups.push({
                    players: similarPlayers,
                    totalPoints: similarPlayers.reduce((sum, p) => sum + p.points, 0)
                });
            }
            
            processed.add(i);
        }
        
        return duplicateGroups;
    },

    // Formate le rapport de doublons
    formatDuplicateReport(duplicateGroups) {
        if (duplicateGroups.length === 0) {
            return "✅ AUCUN DOUBLON DÉTECTÉ\n\nTous les noms semblent uniques dans le classement.";
        }

        let report = `🔍 DOUBLONS POTENTIELS DÉTECTÉS\n`;
        report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        report += `📊 ${duplicateGroups.length} groupe(s) de noms similaires trouvé(s)\n\n`;

        duplicateGroups.forEach((group, index) => {
            const sortedPlayers = group.players.sort((a, b) => b.points - a.points);
            const mainPlayer = sortedPlayers[0];
            
            report += `🔸 GROUPE ${index + 1}:\n`;
            report += `🎯 Joueur principal suggéré: ${mainPlayer.name} (${mainPlayer.points.toLocaleString()} pts)\n`;
            report += `💰 Points totaux du groupe: ${group.totalPoints.toLocaleString()}\n`;
            report += `👥 Comptes similaires:\n`;
            
            sortedPlayers.forEach(player => {
                const status = player === mainPlayer ? " 👑 PRINCIPAL" : " 📥 À fusionner";
                report += `   • ${player.name} - ${player.points.toLocaleString()} pts - Rang #${player.rank}${status}\n`;
            });
            
            // Génère la commande merge suggérée
            const mergeCommand = `/merge ${sortedPlayers.map(p => p.name).join(' ')}`;
            report += `⚡ Commande suggérée: ${mergeCommand}\n\n`;
        });

        report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        report += `💡 Utilisez /merge [noms] pour fusionner les comptes\n`;
        report += `⚠️ Vérifiez manuellement avant de fusionner!`;

        return report;
    }
};

// ===================== MODULE DE FORMATAGE =====================
const formatter = {
    formatLeaderboard() {
        let output = `---🏆 VEƝI🌿VIƊI🌿VIĆI 🏆---\n\n🪽CLASSEMENT DU GROUPE 🪽\n   ⭐️⭐️⭐️JACKPOT ⭐️⭐️⭐️\n^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n`;
        
        CATEGORIES.forEach(category => {
            const players = storage.leaderboard.players
                .filter(p => p.category?.name === category.name)
                .sort((a, b) => a.rank - b.rank);
            
            if (players.length > 0) {
                output += `${category.emoji}${category.name} [${category.min.toLocaleString()}-${category.max.toLocaleString()} P]\n`;
                output += "-\n^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n";
                
                players.forEach(player => {
                    const pointsFormatted = player.points.toLocaleString().padStart(6, ' ');
                    output += `-${player.rank}- ${pointsFormatted} - ${player.name}\n`;
                });
                
                output += "^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n";
            }
            
            if (category.reward) {
                output += `${category.reward}\n^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n`;
            }
        });
        
        output += `\n⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️\nŠI VIS PACÈM, PARÁ BELLƯM\n⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️`;
        return output;
    },

    formatUpdateReport(changes, quizId) {
        let report = `📊 MISE À JOUR DU QUIZ: ${quizId}\n\n`;
        const categoryChanges = [];
        
        changes.forEach(change => {
            if (typeof change === 'string') {
                report += `${change}\n`;
            } else {
                const { name, before, after } = change;
                const player = leaderboard.findPlayer(name);
                
                // Détecter les changements de catégorie
                const beforeCat = leaderboard.getCategory(before)?.name;
                const afterCat = leaderboard.getCategory(after)?.name;
                
                if (beforeCat && afterCat && beforeCat !== afterCat) {
                    categoryChanges.push(`🚀 ${name} est passé de ${beforeCat} à ${afterCat}`);
                }
                
                report += `➤ ${name}: ${before} → ${after} (+${after - before})\n`;
            }
        });
        
        if (categoryChanges.length > 0) {
            report += `\n🎯 CHANGEMENTS DE CATÉGORIE:\n${categoryChanges.join('\n')}`;
        }
        
        return report;
    },

    formatPlayerInfo(playerName) {
        const player = leaderboard.findPlayer(playerName.toUpperCase());
        if (!player) return `❌ Joueur "${playerName}" introuvable`;
        
        return `👤 ${player.name}\n🏆 Rang: ${player.rank}\n⭐ Points: ${player.points}\n📌 Catégorie: ${player.category.emoji} ${player.category.name}`;
    },

    formatHelpMenu() {
        return `🏆 BOT DE MISE À JOUR DES RANGS V.V.V 🏆\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🎯 Conçu exclusivement pour le groupe V.V.V\n` +
            `👤 Développé par @Kageonightray\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            
            `📋 COMMANDES GÉNÉRALES:\n` +
            `🔹 /menu - Affiche ce menu d'aide\n` +
            `🔹 /classement - Affiche le classement complet\n` +
            `🔹 /top [n] - Affiche le top N (défaut: top 10)\n` +
            `🔹 /ma_position [nom] - Position d'un joueur\n` +
            `🔹 /statut - Vos informations personnelles\n\n` +
            
            `📊 HISTORIQUE & SAUVEGARDES:\n` +
            `🔹 /historique_modo - Historique des modérations\n` +
            `🔹 /sauvegardes - Liste des sauvegardes\n` +
            `🔹 /restaurer [fichier] - Restaurer une sauvegarde\n\n` +
            
            `⚙️ COMMANDES ADMINISTRATEUR:\n` +
            `🔸 /ajouter_admin [id] - Ajouter un admin\n` +
            `🔸 /supprimer_admin [id] - Retirer un admin\n` +
            `🔸 /set_classement - Définir classement initial\n` +
            `🔸 /merge [nom1] [nom2] ... - Fusionner les comptes\n` +
            `🔸 /detecter_doublons - Détecter les noms similaires\n` +
            `🔸 Envoyez un quiz pour mise à jour automatique\n\n` +
            
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🌟 VEƝI🌿VIƊI🌿VIĆI - V.V.V 🌟`;
    }
};

// ===================== COMMANDES DU BOT =====================
const commands = {
    handleQuizMessage(msg) {
        const userId = msg.from.id;
        if (!storage.isAdmin(userId)) {
            return bot.sendMessage(msg.chat.id, "❌ Accès refusé. Administrateurs uniquement.");
        }
        
        const quizText = msg.text;
        let quizId = 'QUIZ-' + moment().format('DDHHmmss');
        
        try {
            const quizData = parser.parseQuizText(quizText);
            const date = moment().format('DD/MM/YYYY');
            
            if (!quizData.modo || quizData.participants.length === 0) {
                return bot.sendMessage(msg.chat.id, "❌ Format de quiz invalide. Vérifiez la présence du modérateur et des participants.");
            }
            
            // Si points explicites, procéder directement
            if (quizData.modePoints !== null) {
                this.processQuizUpdate(msg.chat.id, quizData, quizId, date);
                return;
            }
            
            // Si rubriques détectées, demander confirmation
            if (quizData.rubriques.length > 0) {
                const modoPoints = quizData.rubriques.length * 50;
                let confirmationMsg = `🔍 DÉTECTION AUTOMATIQUE DES RUBRIQUES\n\n`;
                confirmationMsg += `👤 Modérateur: ${quizData.modo}\n`;
                confirmationMsg += `📝 Rubriques détectées (${quizData.rubriques.length}):\n`;
                
                quizData.rubriques.forEach((rubrique, index) => {
                    confirmationMsg += `   ${index + 1}. ${rubrique.name}${rubrique.questions ? ` (${rubrique.questions}Q)` : ''}\n`;
                });
                
                confirmationMsg += `\n💰 Points calculés: ${modoPoints} (${quizData.rubriques.length} × 50)\n\n`;
                confirmationMsg += `✅ Tapez "oui" pour confirmer\n❌ Tapez "non" pour annuler`;
                
                bot.sendMessage(msg.chat.id, confirmationMsg);
                
                // Écouter la confirmation
                const confirmationListener = bot.once('message', (confirmMsg) => {
                    if (confirmMsg.from.id === userId && confirmMsg.chat.id === msg.chat.id) {
                        const response = confirmMsg.text.toLowerCase().trim();
                        if (response === 'oui' || response === 'o' || response === 'yes' || response === 'y') {
                            this.processQuizUpdate(msg.chat.id, quizData, quizId, date);
                        } else {
                            bot.sendMessage(msg.chat.id, "❌ Mise à jour annulée. Veuillez corriger le quiz et recommencer.");
                        }
                    }
                });
                
                return;
            }
            
            // Aucune rubrique détectée, utiliser l'ancien système (100 points)
            quizData.modePoints = 100;
            this.processQuizUpdate(msg.chat.id, quizData, quizId, date);
            
        } catch (e) {
            bot.sendMessage(msg.chat.id, `❌ Erreur de traitement: ${e.message}`);
        }
    },

    processQuizUpdate(chatId, quizData, quizId, date) {
        const changes = leaderboard.updateLeaderboard(quizData, quizId, date);
        const leaderboardText = formatter.formatLeaderboard();
        const report = formatter.formatUpdateReport(changes, quizId);
        
        bot.sendMessage(chatId, report);
        bot.sendMessage(chatId, leaderboardText, { parse_mode: 'Markdown' });
    },

    handleTopCommand(msg, match) {
        const count = match[1] ? parseInt(match[1]) : 10;
        const topPlayers = storage.leaderboard.players.slice(0, Math.min(count, 100));
        
        let response = `🏆 TOP ${count} 🏆\n\n`;
        topPlayers.forEach((player, index) => {
            response += `${index + 1}. ${player.name} - ${player.points.toLocaleString()} pts\n`;
        });
        
        bot.sendMessage(msg.chat.id, response);
    },

    handlePositionCommand(msg, match) {
        const playerName = match[1].trim();
        const response = formatter.formatPlayerInfo(playerName);
        bot.sendMessage(msg.chat.id, response);
    },

    handleStatusCommand(msg) {
        const userName = msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : '');
        const response = formatter.formatPlayerInfo(userName);
        bot.sendMessage(msg.chat.id, response);
    },

    handleAdminCommand(msg, match) {
        if (msg.from.id !== SUPER_ADMIN_ID) {
            return bot.sendMessage(msg.chat.id, "❌ Commande réservée au super-admin.");
        }
        
        const [action, userId] = match[1].split(' ');
        if (!userId || !action) {
            return bot.sendMessage(msg.chat.id, "Usage: /admin <add|remove> <user_id>");
        }
        
        let response;
        if (action === 'add') {
            response = storage.addAdmin(userId);
        } else if (action === 'remove') {
            response = storage.removeAdmin(userId);
        } else {
            response = "❌ Action invalide. Utilisez 'add' ou 'remove'";
        }
        
        bot.sendMessage(msg.chat.id, response);
    },

    handleHistoryCommand(msg) {
        const history = storage.getModoHistory();
        if (history.length === 0) {
            return bot.sendMessage(msg.chat.id, "📜 Aucun historique de modération");
        }
        
        let response = "📜 HISTORIQUE DES MODÉRATIONS\n\n";
        history.forEach((record, index) => {
            response += `${index + 1}. ${record.modo} - ${record.quizId} (${record.date})\n`;
        });
        
        bot.sendMessage(msg.chat.id, response);
    },

    handleSetLeaderboard(msg) {
        if (msg.from.id !== SUPER_ADMIN_ID) {
            return bot.sendMessage(msg.chat.id, "❌ Commande réservée au super-admin.");
        }
        
        bot.sendMessage(msg.chat.id, "📋 Veuillez envoyer le classement actuel au format texte");
        
        // Écouter le prochain message pour obtenir le classement
        bot.once('message', (nextMsg) => {
            if (nextMsg.from.id === msg.from.id) {
                try {
                    const players = parser.parseLeaderboardText(nextMsg.text);
                    if (players.length > 0) {
                        leaderboard.setLeaderboardData(players);
                        bot.sendMessage(msg.chat.id, "✅ Classement initial défini avec succès!");
                        bot.sendMessage(msg.chat.id, formatter.formatLeaderboard(), { parse_mode: 'Markdown' });
                    } else {
                        bot.sendMessage(msg.chat.id, "❌ Aucun joueur trouvé dans le classement. Vérifiez le format.");
                    }
                } catch (e) {
                    bot.sendMessage(msg.chat.id, `❌ Erreur de traitement: ${e.message}`);
                }
            }
        });
    },

    handleBackupsList(msg) {
        if (!storage.isAdmin(msg.from.id)) {
            return bot.sendMessage(msg.chat.id, "❌ Accès refusé. Administrateurs uniquement.");
        }
        
        const backups = storage.getBackups();
        if (backups.length === 0) {
            return bot.sendMessage(msg.chat.id, "❌ Aucune sauvegarde disponible");
        }
        
        let response = "📂 SAUVEGARDES DISPONIBLES:\n\n";
        backups.forEach((backup, index) => {
            response += `${index + 1}. ${backup.filename} (${backup.timestamp})\n`;
        });
        
        response += "\nUtilisez /restaurer [fichier] pour restaurer une sauvegarde";
        bot.sendMessage(msg.chat.id, response);
    },

    handleRestoreBackup(msg, match) {
        if (!storage.isAdmin(msg.from.id)) {
            return bot.sendMessage(msg.chat.id, "❌ Accès refusé. Administrateurs uniquement.");
        }
        
        const filename = match[1];
        if (!filename) {
            return bot.sendMessage(msg.chat.id, "Usage: /restaurer [nom_fichier]");
        }
        
        if (storage.restoreBackup(filename)) {
            bot.sendMessage(msg.chat.id, `✅ Classement restauré à partir de ${filename}`);
            bot.sendMessage(msg.chat.id, formatter.formatLeaderboard(), { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(msg.chat.id, "❌ Échec de la restauration. Fichier introuvable ou invalide.");
        }
    },

    handleHelpMenu(msg) {
        bot.sendMessage(msg.chat.id, formatter.formatHelpMenu());
    },

    handleMergeCommand(msg, match) {
        if (!storage.isAdmin(msg.from.id)) {
            return bot.sendMessage(msg.chat.id, "❌ Accès refusé. Administrateurs uniquement.");
        }

        const playerNames = match[1].split(/[,\s]+/).map(name => name.trim().toUpperCase()).filter(name => name);
        
        if (playerNames.length < 2) {
            return bot.sendMessage(msg.chat.id, "❌ Usage: /merge [nom1] [nom2] [nom3] ...\nLe premier nom sera le compte principal qui recevra tous les points.");
        }

        const mainPlayerName = playerNames[0];
        const playersToMerge = playerNames.slice(1);
        
        // Vérifier que tous les joueurs existent
        const existingPlayers = [];
        const missingPlayers = [];
        
        [mainPlayerName, ...playersToMerge].forEach(name => {
            const player = leaderboard.findPlayer(name);
            if (player) {
                existingPlayers.push(player);
            } else {
                missingPlayers.push(name);
            }
        });

        if (missingPlayers.length > 0) {
            return bot.sendMessage(msg.chat.id, `❌ Joueurs introuvables: ${missingPlayers.join(', ')}`);
        }

        const mainPlayer = leaderboard.findPlayer(mainPlayerName);
        let totalMergedPoints = 0;
        const mergeReport = [];
        
        // Fusionner les points des comptes secondaires vers le compte principal
        playersToMerge.forEach(playerName => {
            const playerToMerge = leaderboard.findPlayer(playerName);
            if (playerToMerge && playerToMerge.points > 0) {
                totalMergedPoints += playerToMerge.points;
                mergeReport.push(`📥 ${playerName}: ${playerToMerge.points.toLocaleString()} pts`);
                
                // Supprimer le joueur de la liste
                const playerIndex = storage.leaderboard.players.findIndex(p => p.name === playerName);
                if (playerIndex !== -1) {
                    storage.leaderboard.players.splice(playerIndex, 1);
                }
            }
        });

        if (totalMergedPoints === 0) {
            return bot.sendMessage(msg.chat.id, "❌ Aucun point à fusionner.");
        }

        // Ajouter les points au joueur principal
        const beforePoints = mainPlayer.points;
        mainPlayer.points += totalMergedPoints;
        
        // Réassigner les rangs et sauvegarder
        leaderboard.assignRanks();
        storage.saveData();
        storage.createBackup();

        // Détecter changement de catégorie
        const beforeCat = leaderboard.getCategory(beforePoints)?.name;
        const afterCat = leaderboard.getCategory(mainPlayer.points)?.name;
        const categoryChange = (beforeCat !== afterCat) ? 
            `\n🚀 ${mainPlayerName} est passé de ${beforeCat} à ${afterCat}!` : '';

        // Créer le rapport de fusion
        let response = `🔄 FUSION DE COMPTES RÉUSSIE!\n\n`;
        response += `🎯 Compte principal: ${mainPlayerName}\n`;
        response += `📊 Points avant fusion: ${beforePoints.toLocaleString()}\n`;
        response += `📊 Points après fusion: ${mainPlayer.points.toLocaleString()}\n`;
        response += `🏆 Nouveau rang: #${mainPlayer.rank}\n\n`;
        response += `📥 COMPTES FUSIONNÉS:\n${mergeReport.join('\n')}\n\n`;
        response += `➕ Total des points ajoutés: ${totalMergedPoints.toLocaleString()}${categoryChange}`;

        bot.sendMessage(msg.chat.id, response);
        
        // Enregistrer l'action dans l'historique
        storage.recordModeration(
            `ADMIN-${msg.from.first_name || msg.from.id}`,
            `MERGE-${Date.now()}`,
            moment().format('DD/MM/YYYY')
        );
    },

    handleDetectDuplicates(msg) {
        if (!storage.isAdmin(msg.from.id)) {
            return bot.sendMessage(msg.chat.id, "❌ Accès refusé. Administrateurs uniquement.");
        }

        if (storage.leaderboard.players.length === 0) {
            return bot.sendMessage(msg.chat.id, "❌ Aucun joueur dans le classement.");
        }

        bot.sendMessage(msg.chat.id, "🔍 Analyse en cours des noms similaires...");

        try {
            const duplicateGroups = duplicateDetector.detectDuplicates();
            const report = duplicateDetector.formatDuplicateReport(duplicateGroups);
            
            // Diviser le message si trop long
            const maxLength = 4096;
            if (report.length > maxLength) {
                const chunks = [];
                let currentChunk = "";
                const lines = report.split('\n');
                
                for (const line of lines) {
                    if ((currentChunk + line + '\n').length > maxLength) {
                        if (currentChunk) chunks.push(currentChunk);
                        currentChunk = line + '\n';
                    } else {
                        currentChunk += line + '\n';
                    }
                }
                if (currentChunk) chunks.push(currentChunk);
                
                chunks.forEach((chunk, index) => {
                    setTimeout(() => {
                        bot.sendMessage(msg.chat.id, chunk);
                    }, index * 500);
                });
            } else {
                bot.sendMessage(msg.chat.id, report);
            }

        } catch (error) {
            console.error('Erreur lors de la détection de doublons:', error);
            bot.sendMessage(msg.chat.id, "❌ Erreur lors de l'analyse des doublons.");
        }
    }
};

// ===================== INITIALISATION ET LANCEMENT =====================
storage.loadData();
storage.cleanOldBackups();

// Détection simplifiée des quiz : MODO + participants avec points = quiz automatique
bot.on('message', (msg) => {
    if (msg.text && storage.isAdmin(msg.from.id)) {
        const text = msg.text;
        
        // Détecter la présence d'un modérateur (supports Unicode et caractères stylisés)
        const hasModo = /(?:MODO|MODÉRATEUR|𝗠𝗢𝗗𝗢|𝐌𝐎𝐃𝐎|𝑴𝑶𝑫𝑶|𝙼𝙾𝙳𝙾)/i.test(text);
        
        // Détecter la présence de participants avec points (format standard ou emoji)
        const hasParticipants = /(?:@)?([\w\sÀ-ÿ'-]+)\s+(\d+)/i.test(text) || 
                               /(?:🛡|⚔️)\s*-\s*[\w\sÀ-ÿ'-]*\s+\d+/i.test(text);
        
        // Si MODO + participants avec points = C'EST UN QUIZ !
        if (hasModo && hasParticipants) {
            commands.handleQuizMessage(msg);
        }
    }
});

// Commandes standards
bot.onText(/\/start|\/menu|\/help/, (msg) => {
    commands.handleHelpMenu(msg);
});

bot.onText(/\/classement/, (msg) => {
    bot.sendMessage(msg.chat.id, formatter.formatLeaderboard(), { parse_mode: 'Markdown' });
});

bot.onText(/\/top(?:\s+(\d+))?/, (msg, match) => {
    commands.handleTopCommand(msg, match);
});

bot.onText(/\/ma_position (.+)/, (msg, match) => {
    commands.handlePositionCommand(msg, match);
});

bot.onText(/\/statut/, (msg) => {
    commands.handleStatusCommand(msg);
});

bot.onText(/\/historique_modo/, (msg) => {
    commands.handleHistoryCommand(msg);
});

bot.onText(/\/sauvegardes/, (msg) => {
    commands.handleBackupsList(msg);
});

bot.onText(/\/restaurer (.+)/, (msg, match) => {
    commands.handleRestoreBackup(msg, match);
});

// Commandes admin
bot.onText(/\/admin (.+)/, (msg, match) => {
    commands.handleAdminCommand(msg, match);
});

bot.onText(/\/set_classement/, (msg) => {
    commands.handleSetLeaderboard(msg);
});

bot.onText(/\/merge (.+)/, (msg, match) => {
    commands.handleMergeCommand(msg, match);
});

bot.onText(/\/detecter_doublons/, (msg) => {
    commands.handleDetectDuplicates(msg);
});

console.log('🤖 Bot V.V.V en écoute...');
console.log('👤 Développé par @Kageonightray');
console.log('🎯 Exclusif pour le groupe V.V.V');

// Démarrage du système keep-alive
if (process.env.REPLIT_ENVIRONMENT || process.env.RENDER) {
    keepAlive();
    startPinging();
    console.log('🔄 Système keep-alive activé pour le déploiement');
}

// Gestion des erreurs
process.on('uncaughtException', (err) => {
    console.error('Erreur non gérée:', err);
});
