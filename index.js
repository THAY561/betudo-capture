// v2026-06-03b
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'betudo2024';

const ARQUIVOS = {
    aviator: 'dados.csv',
    vip:     'dados_vip.csv'
};

app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Inicializa arquivos CSV se não existirem
Object.values(ARQUIVOS).forEach(f => {
    if (!fs.existsSync(f)) fs.writeFileSync(f, 'Data,Horario,RoundID,MaxMultiplier\n');
});

const seenRounds = new Map();

function salvarRound(roundId, maxMultiplier, arquivo) {
    const key = arquivo + ':' + roundId;
    const agora = Date.now();
    if (seenRounds.has(key) && agora - seenRounds.get(key) < 15000) return false;
    seenRounds.set(key, agora);
    const now = new Date();
    const data = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horario = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    fs.appendFileSync(arquivo, data + ',' + horario + ',' + roundId + ',' + maxMultiplier + '\n');
    console.log('[' + arquivo + '] Round ' + roundId + ' | ' + maxMultiplier + 'x | ' + horario);
    return true;
}

app.post('/collect', (req, res) => {
    const { key, roundId, maxMultiplier, game } = req.body || {};
    if (key !== API_KEY) return res.status(401).json({ error: 'chave invalida' });
    if (!roundId || maxMultiplier === undefined) return res.status(400).json({ error: 'dados incompletos' });
    const arquivo = ARQUIVOS[game] || ARQUIVOS.aviator;
    const saved = salvarRound(Number(roundId), Number(maxMultiplier), arquivo);
    res.json({ ok: true, saved, game: game || 'aviator' });
});

app.get('/api/rounds', (req, res) => {
    try {
        const game = req.query.game || 'aviator';
        const arquivo = ARQUIVOS[game] || ARQUIVOS.aviator;
        const dados = fs.readFileSync(arquivo, 'utf8');
        const linhas = dados.trim().split('\n').slice(1).filter(Boolean);
        const result = linhas.map(l => {
            const p = l.split(',');
            return { data: p[0]||'', horario: p[1]||'', roundId: Number(p[2])||0, maxMultiplier: Number(p[3])||0 };
        });
        res.json(result);
    } catch(e) { res.json([]); }
});

app.get('/baixar', (req, res) => {
    const game = req.query.game || 'aviator';
    res.download(ARQUIVOS[game] || ARQUIVOS.aviator);
});

app.post('/api/clear', (req, res) => {
    const { key, game } = req.body || {};
    if (key !== API_KEY) return res.status(401).json({ error: 'chave invalida' });
    const arquivo = ARQUIVOS[game] || ARQUIVOS.aviator;
    fs.writeFileSync(arquivo, 'Data,Horario,RoundID,MaxMultiplier\n');
    // Limpa seenRounds do arquivo correspondente
    for (const k of seenRounds.keys()) { if (k.startsWith(arquivo + ':')) seenRounds.delete(k); }
    console.log('[CLEAR] ' + arquivo + ' limpo');
    res.json({ ok: true, game: game || 'aviator' });
});

app.listen(PORT, () => console.log('Servidor rodando na porta ' + PORT));
