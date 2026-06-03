// v2026-06-03
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'betudo2024';
const ARQUIVO = 'dados.csv';

app.use(express.json());
app.use(express.static('public'));

// CORS — permite requisições da extensão Chrome e do betudo.bet
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

if (!fs.existsSync(ARQUIVO)) {
    fs.writeFileSync(ARQUIVO, 'Data,Horario,RoundID,MaxMultiplier\n');
}

const seenRounds = new Map();

function salvarRound(roundId, maxMultiplier) {
    const agora = Date.now();
    if (seenRounds.has(roundId) && agora - seenRounds.get(roundId) < 15000) return false;
    seenRounds.set(roundId, agora);
    const now = new Date();
    const data = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horario = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    fs.appendFileSync(ARQUIVO, data + ',' + horario + ',' + roundId + ',' + maxMultiplier + '\n');
    console.log('Round ' + roundId + ' | ' + maxMultiplier + 'x | ' + horario);
    return true;
}

app.post('/collect', (req, res) => {
    const { key, roundId, maxMultiplier } = req.body || {};
    if (key !== API_KEY) return res.status(401).json({ error: 'chave invalida' });
    if (!roundId || maxMultiplier === undefined) return res.status(400).json({ error: 'dados incompletos' });
    const saved = salvarRound(Number(roundId), Number(maxMultiplier));
    res.json({ ok: true, saved });
});

app.get('/', (req, res) => {
    try {
        const dados = fs.readFileSync(ARQUIVO, 'utf8');
        const linhas = dados.trim().split('\n').slice(1).filter(Boolean);
        const total = linhas.length;
        const rows = linhas.slice(-30).reverse().map(l => {
            const p = l.split(',');
            return '<tr><td>' + (p[0]||'') + '</td><td>' + (p[1]||'') + '</td><td>' + (p[2]||'') + '</td><td class="m">' + (p[3]||'') + 'x</td></tr>';
        }).join('');
        res.send('<!DOCTYPE html><html><head><meta charset="utf-8">'
        + '<meta http-equiv="refresh" content="10"><title>Betudo Aviator</title>'
        + '<style>body{font-family:Arial;max-width:780px;margin:40px auto;padding:20px;background:#0a0a0a;color:#ddd}'
        + 'h2{color:#00ff88}a.btn{display:inline-block;padding:10px 22px;background:#28a745;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;margin:8px 4px}'
        + 'table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #222;padding:7px 12px;font-size:13px}'
        + 'th{background:#161616;color:#666}.m{color:#00ffff;font-weight:bold}</style></head><body>'
        + '<h2>Betudo Aviator Monitor</h2>'
        + '<p>Rodadas capturadas: <b style="color:#00ff88">' + total + '</b></p>'
        + '<a class="btn" href="/baixar">Baixar CSV</a>'
        + '<table><tr><th>Data</th><th>Horario</th><th>Round ID</th><th>Multiplicador</th></tr>' + rows + '</table>'
        + '</body></html>');
    } catch(e) { res.send('<p>Aguardando dados...</p>'); }
});

app.get('/baixar', (req, res) => { res.download(ARQUIVO); });

app.get('/dados', (req, res) => {
    const d = fs.readFileSync(ARQUIVO, 'utf8');
    res.type('text/plain').send(d.trim().split('\n').slice(-21).join('\n'));
});

app.get('/api/rounds', (req, res) => {
    try {
        const dados = fs.readFileSync(ARQUIVO, 'utf8');
        const linhas = dados.trim().split('\n').slice(1).filter(Boolean);
        const result = linhas.map(l => {
            const p = l.split(',');
            return { data: p[0]||'', horario: p[1]||'', roundId: Number(p[2])||0, maxMultiplier: Number(p[3])||0 };
        });
        res.json(result);
    } catch(e) { res.json([]); }
});

app.listen(PORT, () => console.log('Servidor rodando na porta ' + PORT));
