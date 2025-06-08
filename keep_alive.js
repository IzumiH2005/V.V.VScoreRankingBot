const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Route de santé pour le monitoring
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    res.json({
        status: 'alive',
        uptime: uptime,
        memory: memoryUsage,
        timestamp: new Date().toISOString(),
        bot: 'V.V.V Telegram Bot',
        version: '2.0'
    });
});

// Route principale avec le dashboard
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Fonction pour démarrer le serveur keep-alive
function keepAlive() {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Serveur keep-alive démarré sur le port ${PORT}`);
        console.log('📡 Bot accessible via HTTP pour monitoring');
    });
}

// Fonction pour envoyer des pings périodiques (optionnel pour certains services)
function startPinging() {
    setInterval(() => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('fr-FR');
        const uptime = Math.floor(process.uptime());
        const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        console.log(`🏓 Ping automatique - ${timeString}`);
        console.log(`📊 Mémoire utilisée: ${memoryMB} MB`);
        console.log(`⏱️ Uptime: ${uptime} secondes`);
    }, 300000); // Ping toutes les 5 minutes
}

module.exports = { keepAlive, startPinging };