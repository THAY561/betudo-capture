// Betudo Aviator Collector v3.3 — fila de rounds até confirmar o jogo
(function () {
    if (window.__aviatorBotInstalled) return;
    window.__aviatorBotInstalled = true;

    const RAILWAY_URL = 'https://betudo-capture-production.up.railway.app/collect';
    const API_KEY = 'betudo2024';
    const seenRounds = new Set();
    let gameType = null;          // null = ainda não confirmado
    const queue = [];             // rounds aguardando confirmação do jogo

    const isTop = (window === window.top);

    // ── Confirma o jogo e libera a fila ──────────────────────────────────
    function confirmarJogo(game) {
        if (gameType !== null) return; // já confirmado
        gameType = game;
        console.info('[AviatorBot] ✓ jogo confirmado: ' + game + ' (' + queue.length + ' na fila)');
        queue.splice(0).forEach(({ id, mult }) => enviarNow(id, mult, game));
    }

    // ── Frame PAI: detecta o jogo pela URL ───────────────────────────────
    if (isTop) {
        const g = window.location.href.includes('aviator-vip') ? 'vip' : 'aviator';
        confirmarJogo(g);

        // Responde pedidos dos iframes filhos
        window.addEventListener('message', function (e) {
            if (e.data && e.data.__aviatorBotRequest) {
                try { e.source.postMessage({ __aviatorBotGame: gameType }, '*'); } catch (err) {}
            }
        });

    // ── Frame FILHO: pede o jogo ao pai ──────────────────────────────────
    } else {
        window.addEventListener('message', function (e) {
            if (e.data && e.data.__aviatorBotGame) {
                confirmarJogo(e.data.__aviatorBotGame);
            }
        });

        // Pede ao pai — repete algumas vezes para garantia
        function askParent() {
            try { window.parent.postMessage({ __aviatorBotRequest: true }, '*'); } catch (err) {}
        }
        [0, 150, 400, 800, 1500, 3000].forEach(t => setTimeout(askParent, t));
    }

    // ── Envia round imediatamente (jogo já confirmado) ────────────────────
    function enviarNow(id, mult, game) {
        const key = game + ':' + id;
        if (seenRounds.has(key)) return;
        seenRounds.add(key);

        fetch(RAILWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, roundId: id, maxMultiplier: mult, game })
        })
        .then(r => r.json())
        .then(() => console.info('[AviatorBot] ✓ Round ' + id + ' | ' + mult + 'x | ' + game))
        .catch(() => {});
    }

    // ── Captura round (coloca na fila se jogo ainda não confirmado) ───────
    function enviarRound(roundId, maxMultiplier) {
        const id = Number(roundId);
        const mult = Number(maxMultiplier);
        if (!id || !mult || mult <= 0) return;
        if (gameType === null) {
            queue.push({ id, mult });  // aguarda confirmação
        } else {
            enviarNow(id, mult, gameType);
        }
    }

    function verificarDados(a) {
        if (!a) return;
        if (typeof a === 'object' && 'maxMultiplier' in a && 'roundId' in a) {
            enviarRound(a.roundId, a.maxMultiplier); return;
        }
        if (typeof a === 'string' && a.includes('maxMultiplier')) {
            try {
                const p = JSON.parse(a);
                if ('maxMultiplier' in p && 'roundId' in p) { enviarRound(p.roundId, p.maxMultiplier); return; }
            } catch (e) {}
            const mr = a.match(/roundId[^\d]*(\d+)/);
            const mm = a.match(/maxMultiplier[^\d]*([\d.]+)/);
            if (mr && mm) enviarRound(mr[1], mm[1]);
        }
    }

    // ── Interceptar console.log ───────────────────────────────────────────
    const _log = console.log.bind(console);
    console.log = function () {
        _log.apply(console, arguments);
        try { Array.prototype.slice.call(arguments).forEach(verificarDados); } catch (e) {}
    };

    // ── Interceptar WebSocket ─────────────────────────────────────────────
    const OrigWS = window.WebSocket;
    if (OrigWS) {
        function PatchedWS(url, protocols) {
            const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
            ws.addEventListener('message', function (event) {
                try {
                    if (typeof event.data !== 'string') return;
                    if (!event.data.includes('maxMultiplier') && !event.data.includes('roundId')) return;
                    const data = JSON.parse(event.data);
                    verificarDados(data);
                    if (data && data.data)    verificarDados(data.data);
                    if (data && data.payload) verificarDados(data.payload);
                    if (data && data.result)  verificarDados(data.result);
                } catch (e) {}
            });
            return ws;
        }
        PatchedWS.prototype = OrigWS.prototype;
        PatchedWS.CONNECTING = OrigWS.CONNECTING;
        PatchedWS.OPEN = OrigWS.OPEN;
        PatchedWS.CLOSING = OrigWS.CLOSING;
        PatchedWS.CLOSED = OrigWS.CLOSED;
        window.WebSocket = PatchedWS;
    }

    console.info('[AviatorBot] v3.3 | ' + (isTop ? 'pai' : 'filho aguardando jogo...'));
})();
