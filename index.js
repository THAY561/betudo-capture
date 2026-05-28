const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const EMAIL = process.env.EMAIL;
const SENHA = process.env.SENHA;
const ARQUIVO = 'dados.csv';

let debugPage = null;

if (!fs.existsSync(ARQUIVO)) {
    fs.writeFileSync(ARQUIVO, 'Horario,RoundID,MaxMultiplier\n');
}

const seenRounds = new Map();

function salvarRound(roundId, maxMultiplier) {
    const agora = Date.now();
    if (seenRounds.has(roundId) && agora - seenRounds.get(roundId) < 15000) return;
    seenRounds.set(roundId, agora);
    const horario = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const linha = horario + ',' + roundId + ',' + maxMultiplier + '\n';
    fs.appendFileSync(ARQUIVO, linha);
    console.log('Round ' + roundId + ' | ' + maxMultiplier + 'x | ' + horario);
}

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
      for(var j=0;j<a.length;j++){
        var s=a[j];
        if(typeof s!=='string'||s.indexOf('maxMultiplier')<0)continue;
        try{var p=JSON.parse(s);if('maxMultiplier'in p&&'roundId'in p){window.__rq.push({r:+p.roundId,m:+p.maxMultiplier});return;}}catch(e){}
        var mr=s.match(/roundId[^\\d]*(\\d+)/);
        var mm=s.match(/maxMultiplier[^\\d]*([\\d.]+)/);
        if(mr&&mm)window.__rq.push({r:+mr[1],m:+mm[1]});
      }
    }catch(e){}
  };
})();`;

async function tryClick(page, sels) {
    for (const sel of sels) {
        try {
            await page.waitForSelector(sel, { timeout: 3000, visible: true });
            await page.click(sel);
            return true;
        } catch(e) {}
    }
    return false;
}

async function tryType(page, sels, text) {
    for (const sel of sels) {
        try {
            await page.waitForSelector(sel, { timeout: 3000, visible: true });
            await page.type(sel, text, { delay: 60 });
            console.log('Seletor encontrado: ' + sel);
            return true;
        } catch(e) {}
    }
    return false;
}

// Rota principal
app.get('/', (req, res) => {
    try {
        const dados = fs.readFileSync(ARQUIVO, 'utf8');
        const linhas = dados.trim().split('\n').slice(1);
        const total = linhas.length;
        const rows = linhas.slice(-20).reverse().map(l => {
            const p = l.split(',');
            return '<tr><td>' + (p[0]||'') + '</td><td>' + (p[1]||'') + '</td><td class="m">' + (p[2]||'') + 'x</td></tr>';
        }).join('');
        res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="10"><title>Betudo</title>'
        + '<style>body{font-family:Arial;max-width:700px;margin:40px auto;padding:20px;background:#0a0a0a;color:#ddd}'
        + 'h2{color:#00ff88}a.btn{display:inline-block;padding:10px 22px;background:#28a745;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;margin:8px 4px}'
        + 'table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #222;padding:7px 12px;font-size:13px}'
        + 'th{background:#161616;color:#666}.m{color:#00ffff;font-weight:bold}</style></head><body>'
        + '<h2>Betudo Crash Monitor</h2><p>Rodadas: <b style="color:#00ff88">' + total + '</b></p>'
        + '<a class="btn" href="/baixar">Baixar CSV</a>'
        + '<a class="btn" href="/debug" style="background:#0077cc">Debug Screenshot</a>'
        + '<table><tr><th>Horario</th><th>Round ID</th><th>Multiplicador</th></tr>' + rows + '</table>'
        + '</body></html>');
    } catch(e) { res.send('<p>Aguardando dados...</p>'); }
});

app.get('/baixar', (req, res) => { res.download(ARQUIVO); });

app.get('/dados', (req, res) => {
    const dados = fs.readFileSync(ARQUIVO, 'utf8');
    res.type('text/plain').send(dados.trim().split('\n').slice(-21).join('\n'));
});

// Endpoint de debug: serve screenshot ao vivo do headless browser
app.get('/debug', async (req, res) => {
    try {
        if (debugPage) {
            await debugPage.screenshot({ path: 'debug.png', fullPage: true });
        }
        if (fs.existsSync('debug.png')) {
            const img = fs.readFileSync('debug.png').toString('base64');
            res.send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Debug</title>'
            + '<style>body{background:#111;margin:0;padding:10px}img{max-width:100%}h2{color:#fff;font-family:Arial}</style></head><body>'
            + '<h2>Screenshot ao vivo (recarregue para atualizar)</h2>'
            + '<img src="data:image/png;base64,' + img + '">'
            + '</body></html>');
        } else {
            res.send('<p>Screenshot nao disponivel ainda.</p>');
        }
    } catch(e) { res.send('<p>Erro: ' + e.message + '</p>'); }
});

app.listen(PORT, () => console.log('Servidor na porta ' + PORT));

// Bot principal
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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
        const page = await browser.newPage();
        debugPage = page;

        await page.evaluateOnNewDocument(SCRIPT);

        page.on('console', (msg) => {
            try {
                const texto = msg.text();
                if (!texto.includes('maxMultiplier')) return;
                msg.args().forEach(async (arg) => {
                    try {
                        const val = await arg.jsonValue();
                        if (val && val.roundId !== undefined) {
                            salvarRound(Number(val.roundId), Number(val.maxMultiplier));
                        }
                    } catch(e) {}
                });
            } catch(e) {}
        });

        const poll = setInterval(async () => {
            try {
                for (const frame of page.frames()) {
                    try {
                        const items = await frame.evaluate(
                            '(()=>{var q=window.__rq||[];window.__rq=[];return q;})()'
                        );
                        for (const item of items) {
                            if (item.r && item.m) salvarRound(Number(item.r), Number(item.m));
                        }
                    } catch(e) {}
                }
            } catch(e) {}
        }, 3000);

        // Login
        console.log('Fazendo login...');
        await page.goto('https://www.betudo.bet/?modal=login', { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: 'debug.png' });
        console.log('Screenshot inicial salvo.');

        try { await page.waitForSelector('input', { timeout: 12000, visible: true }); } catch(e) {}
        const inputInfo = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).slice(0,8).map(i =>
                '[type=' + i.type + ' name=' + i.name + ' ph=' + i.placeholder.substring(0,20) + ']'
            ).join(', ');
        });
        console.log('DEBUG inputs: ' + (inputInfo || 'nenhum'));
        await page.screenshot({ path: 'debug.png' });

        const emailSels = [
            'input[type="email"]', 'input[name="email"]', 'input[name="username"]',
            'input[name="login"]', 'input[name="identifier"]',
            'input[type="tel"]', 'input[name="phone"]', 'input[name="cpf"]',
            'input[placeholder*="email" i]', 'input[placeholder*="CPF" i]',
            'input[placeholder*="telefone" i]', 'input[placeholder*="login" i]',
            'input[placeholder*="usuario" i]'
        ];

        const filled = await tryType(page, emailSels, EMAIL);
        if (!filled) {
            console.log('AVISO: campo de login nao encontrado');
        } else {
            await new Promise(r => setTimeout(r, 500));
            const senhaFilled = await tryType(page, [
                'input[type="password"]', 'input[name="password"]',
                'input[name="senha"]', 'input[placeholder*="senha" i]',
                'input[placeholder*="password" i]'
            ], SENHA);
            if (senhaFilled) {
                await new Promise(r => setTimeout(r, 500));
                await tryClick(page, ['button[type="submit"]', '.btn-login']);
                console.log('Formulario submetido.');
            }
        }

        await new Promise(r => setTimeout(r, 5000));
        await page.screenshot({ path: 'debug.png' });
        console.log('Login concluido. Navegando para Aviator...');

        try {
            await page.goto('https://www.betudo.bet/casino/spribe/aviator', { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(r => setTimeout(r, 5000));
            await page.screenshot({ path: 'debug.png' });
        } catch(e) {
            console.log('Erro ao navegar para Aviator: ' + e.message);
        }

        console.log('Monitorando rodadas em tempo real...');

        setInterval(async () => {
            try {
                await page.evaluate(() => document.title);
            } catch(e) {
                console.log('Pagina caiu, reconectando...');
                clearInterval(poll);
                debugPage = null;
                try { await browser.close(); } catch(e) {}
                setTimeout(iniciar, 5000);
            }
        }, 30000);

    } catch(err) {
        console.error('Erro:', err.message);
        debugPage = null;
        try { if (browser) await browser.close(); } catch(e) {}
        setTimeout(iniciar, 10000);
    }
}

iniciar();
