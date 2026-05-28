const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = 'https://betudo.bet';
const EMAIL = process.env.EMAIL;
const SENHA = process.env.SENHA;
const ARQUIVO = 'dados.csv';

// Cria o CSV com cabeçalho se não existir
if (!fs.existsSync(ARQUIVO)) {
  fs.writeFileSync(ARQUIVO, 'Horario,RoundID,MaxMultiplier\n');
}

// Rota principal
app.get('/', (req, res) => {
  const dados = fs.readFileSync(ARQUIVO, 'utf8');
  const linhas = dados.trim().split('\n').length - 1;
  res.send(`
    <html>
    <head>
      <title>Betudo Capture</title>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
        h2 { color: #333; }
        button { padding: 12px 24px; margin: 8px; font-size: 16px; cursor: pointer; border: none; border-radius: 6px; }
        .verde { background: #28a745; color: white; }
        .azul { background: #007bff; color: white; }
      </style>
    </head>
    <body>
      <h2>📊 Betudo Capture</h2>
      <p>✅ Rodadas capturadas: <strong>${linhas}</strong></p>
      <br>
      <a href="/baixar"><button class="verde">⬇️ Baixar CSV</button></a>
      <a href="/dados"><button class="azul">📋 Ver últimos 20</button></a>
    </body>
    </html>
  `);
});

// Rota para baixar o CSV
app.get('/baixar', (req, res) => {
  res.download(ARQUIVO);
});

// Rota para ver últimos registros
app.get('/dados', (req, res) => {
  const linhas = fs.readFileSync(ARQUIVO, 'utf8').trim().split('\n');
  const ultimas = linhas.slice(-21).join('\n');
  res.type('text/plain').send(ultimas);
});

app.listen(PORT, () => console.log(`🌐 Servidor rodando na porta ${PORT}`));

// Inicia o Puppeteer
async function iniciar() {
  console.log('🚀 Iniciando captura...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();

  // Captura logs do console da página
  page.on('console', msg => {
    try {
      const texto = msg.text();
      if (texto.includes('roundChartInfo')) {
        msg.args().forEach(async arg => {
          try {
            const val = await arg.jsonValue();
            if (val && val.roundId !== undefined) {
              const horario = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
              const linha = `${horario},${val.roundId},${val.maxMultiplier}\n`;
              fs.appendFileSync(ARQUIVO, linha);
              console.log(`✅ Capturado: Round ${val.roundId} | ${val.maxMultiplier}x | ${horario}`);
            }
          } catch(e) {}
        });
      }
    } catch(e) {}
  });

  // Faz login
  try {
    console.log('🔐 Fazendo login...');
    await page.goto(SITE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Tenta clicar no botão de login
    await page.click('[data-action="login"], .login-btn, button')
      .catch(() => console.log('⚠️ Botão login não encontrado, continuando...'));

    await page.waitForTimeout(2000);

    // Preenche email
    await page.type('input[type="email"], input[name="email"], input[name="username"]', EMAIL, { delay: 60 });
    await page.waitForTimeout(500);

    // Preenche senha
    await page.type('input[type="password"]', SENHA, { delay: 60 });
    await page.waitForTimeout(500);

    // Submete o formulário
    await page.click('button[type="submit"], .btn-login');
    await page.waitForTimeout(5000);

    console.log('✅ Login realizado! Navegando para o jogo...');

    // Tenta ir para a página do crash
    await page.goto(`${SITE_URL}/casino/crash`, { waitUntil: 'networkidle2', timeout: 60000 })
      .catch(async () => {
        console.log('⚠️ URL do crash não encontrada, voltando para home...');
        await page.goto(SITE_URL, { waitUntil: 'networkidle2' });
      });

    console.log('🎮 Na página do jogo. Capturando dados em tempo real...');

  } catch(err) {
    console.error('❌ Erro no login:', err.message);
  }

  // Verifica a cada 30s se a página ainda está ativa, reconecta se cair
  setInterval(async () => {
    try {
      await page.evaluate(() => document.title);
    } catch(e) {
      console.log('🔄 Página caiu, reconectando...');
      try { await browser.close(); } catch(e) {}
      setTimeout(iniciar, 5000);
    }
  }, 30000);
}

iniciar();
