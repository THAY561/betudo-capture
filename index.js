const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = 'https://betudo.bet';
const EMAIL = process.env.EMAIL;
const SENHA = process.env.SENHA;
const ARQUIVO = 'dados.csv';

if (!fs.existsSync(ARQUIVO)) {
    fs.writeFileSync(ARQUIVO, 'Horario,RoundID,MaxMultiplier\n');
}

const seenRounds = new Map();

function salvarRound(roundId, maxMultiplier) {
    const agora = Date.now();
    if (seenRounds.has(roundId) && agora - seenRounds.get(roundId) < 15000) return;
    seenRounds.set(roundId, agora);
    const horario = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const linha = `${horario},${roundId},${maxMultiplier}\n`;
    fs.appendFileSync(ARQUIVO, linha);
    console.log(`Round ${roundId} | ${maxMultiplier}x | ${horario}`);
}

// Script injetado em TODOS os frames (incluindo iframe cross-origin da Spribe)
const SCRIPT = `(function(){
  if(window.__cm)return;
  window.__cm=true;
  window.__rq=[];
  var _l=console.log.bind(console);
  console.log=function(){
    _l.apply(console,arguments);
    try{
      var a=Array.prototype.slice.call(arguments);
      for(var i=0;i<a.length;i++){
        if(a[i]&&typeof a[i]==='object'&&'maxMultiplier'in a[i]&&'roundId'in a[i]){
          window.__rq.push({r:a[i].roundId,m:a[i].maxMultiplier});
          return;
        }
      }
    }catch(e){}
  };
})();`;

app.get('/', (req, res) => {
    try {
        const dados = fs.readFileSync(ARQUIVO, 'utf8');
        const linhas = dados.trim().split('\n').slice(1);
        const total = linhas.length;
        const rows = linhas.slice(-20).reverse().map(l => {
            const p = l.split(',');
            return `<tr><td>${p[0]||''}</td><td>${p[1]||''}</td><td class="m">${p[2]||''}x</td></tr>`;
        }).join('');
        res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta http-equiv="refresh" content="10">
<title>Betudo Capture</title>
<style>
body{font-family:Arial;max-width:700px;margin:40px auto;padding:20px;background:#0a0a0a;color:#ddd}
h2{color:#00ff88}.n{font-size:2rem;font-weight:bold;color:#00ff88}
a.btn{display:inline-block;padding:10px 22px;background:#28a745;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border:1px solid #222;padding:7px 12px;font-size:13px}
th{background:#161616;color:#666}.m{color:#00ffff;font-weight:bold}
</style></head><body>
<h2>Betudo Crash Monitor</h2>
<p>Rodadas capturadas: <span class="n">${total}</span></p>
<a class="btn" href="/baixar">Baixar CSV</a>
<table><tr><th>Horario</th><th>Round ID</th><th>Multiplicador</th></tr>${rows}</table>
</body></html>`);
    } catch(e) { res.send('<p>Aguardando dados...</p>'); }
});

app.get('/baixar', (req, res) => { res.download(ARQUIVO); });

app.get('/dados', (req, res) => {
    const dados = fs.readFileSync(ARQUIVO, 'utf8');
    res.type('text/plain').send(dados.trim().split('\n').slice(-21).join('\n'));
});

app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));

async function iniciar() {
    console.log('Iniciando...');

    if (!EMAIL || !SENHA) {
        console.error('EMAIL e SENHA nao configurados!');
        setTimeout(iniciar, 60000);
        return;
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
        });

        const page = await browser.newPage();

        // Injeta interceptor em TODOS os frames (incluindo iframes cross-origin da Spribe)
        await page.evaluateOnNewDocument(SCRIPT);

        // Fallback: console listener no frame principal
        page.on('console', (msg) => {
            try {
                const texto = msg.text();
                if (!texto.includes('roundChartInfo') && !texto.includes('maxMultiplier')) return;
                msg.args().forEach(async (arg) => {
                    try {
                        const val = await arg.jsonValue();
                        if (val && val.roundId !== undefined)
                            salvarRound(Number(val.roundId), Number(val.maxMultiplier));
                    } catch(e) {}
                });
            } catch(e) {}
        });

        // Poll de todos os frames a cada 3s (captura dados de iframes cross-origin)
        const poll = setInterval(async () => {
            try {
                for (const frame of page.frames()) {
                    try {
                        const items = await frame.evaluate(
                            `(()=>{var q=window.__rq||[];window.__rq=[];return q;})()`
                        );
                        for (const item of items)
                            if (item.r && item.m) salvarRound(Number(item.r), Number(item.m));
                    } catch(e) {}
                }
            } catch(e) {}
        }, 3000);

        // Login
        console.log('Fazendo login...');
        await page.goto(SITE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        const loginSels = ['[data-action="login"]','.login-btn','[class*="loginBtn"]','[class*="LoginButton"]'];
        let loginClicked = false;
        for (const sel of loginSels) {
            try { await page.click(sel); loginClicked = true; break; } catch(e) {}
        }
        if (!loginClicked) {
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button,a'))
                    .find(b => /entrar|login/i.test(b.textContent.trim()));
                if (btn) btn.click();
            });
        }
        await new Promise(r => setTimeout(r, 2000));

        await page.type('input[type="email"],input[name="email"],input[name="username"]', EMAIL, { delay: 60 });
        await new Promise(r => setTimeout(r, 500));
        await page.type('input[type="password"]', SENHA, { delay: 60 });
        await new Promise(r => setTimeout(r, 500));

        const submitSels = ['button[type="submit"]','.btn-login','[class*="submitBtn"]'];
        let submitted = false;
        for (const sel of submitSels) {
            try { await page.click(sel); submitted = true; break; } catch(e) {}
        }
        if (!submitted) await page.evaluate(() => { const f=document.querySelector('form'); if(f)f.submit(); });

        await new Promise(r => setTimeout(r, 5000));
        console.log('Login concluido. Navegando para crash...');

        try {
            await page.goto(`${SITE_URL}/casino/crash`, { waitUntil: 'networkidle2', timeout: 60000 });
        } catch(e) {
            await page.goto(SITE_URL, { waitUntil: 'networkidle2' }).catch(()=>{});
        }
        console.log('Monitorando rodadas em tempo real...');

        // Watchdog: reconecta se a pagina cair
        setInterval(async () => {
            try { await page.evaluate(() => document.title); }
            catch(e) {
                clearInterval(poll);
                try { await browser.close(); } catch(e) {}
                setTimeout(iniciar, 5000);
            }
        }, 30000);

    } catch(err) {
        console.error('Erro:', err.message);
        try { if (browser) await browser.close(); } catch(e) {}
        setTimeout(iniciar, 10000);
    }
}

iniciar();
