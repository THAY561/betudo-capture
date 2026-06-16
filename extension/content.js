// Betudo Aviator Collector v3.5 — dual game, SPA-safe, horário do cliente

(function () {
    if (window.__aviatorBotInstalled) return;
    window.__aviatorBotInstalled = true;

    const RAILWAY_URL = 'https://betudo-capture-production.up.railway.app/collect';
    const API_KEY = 'betudo2024';
    const seenRounds = new Set();
    let gameType = null;
    const queue = [];
    const isTop = (window === window.top);

    // ── Confirma o jogo e libera a fila ──────────────────────────────────
    function confirmarJogo(game) {
        if (gameType !== null) return;
        gameType = game;
        console.info('[AviatorBot] ✓ jogo confirmado: ' + game + ' (' + queue.length + ' na fila)');
        queue.splice(0).forEach(({ id, mult, ct, cd }) => enviarNow(id, mult, game, ct, cd));
    }

    // ── Frame PAI (betudo.bet): responde com URL atual em tempo real ──────
    if (isTop) {
        window.addEventListener('message', function (e) {
            if (e.data && e.data.__aviatorBotRequest) {
                const g = window.location.href.includes('aviator-vip') ? 'vip' : 'aviator';
                try { e.source.postMessage({ __aviatorBotGame: g }, '*'); } catch (err) {}
            }
        });

    // ── Frame FILHO (Spribe iframe): pede o jogo ao pai ──────────────────
    } else {
        window.addEventListener('message', function (e) {
            if (e.data && e.data.__aviatorBotGame) {
                confirmarJogo(e.data.__aviatorBotGame);
            }
        });

        function askParent() {
            try { window.parent.postMessage({ __aviatorBotRequest: true }, '*'); } catch (err) {}
        }
        [0, 200, 500, 1000, 2000, 4000].forEach(t => setTimeout(askParent, t));
    }

    // ── Envia round ao Railway ────────────────────────────────────────────
    function enviarNow(id, mult, game, clientTime, clientDate) {
        const key = game + ':' + id;
        if (seenRounds.has(key)) return;
        seenRounds.add(key);

        fetch(RAILWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, roundId: id, maxMultiplier: mult, game, clientTime, clientDate })
        })
        .then(r => r.json())
        .then(() => console.info('[AviatorBot] ✓ Round ' + id + ' | ' + mult + 'x | ' + game + ' | ' + clientTime))
        .catch(() => {});
    }

    // ── Captura round ─────────────────────────────────────────────────────
    function enviarRound(roundId, maxMultiplier) {
        const id = Number(roundId);
        const mult = Number(maxMultiplier);
        if (!id || !mult || mult <= 0) return;

        const now = new Date();
        const ct = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const cd = now.toLocaleDateString('pt-BR');

        if (gameType === null) {
            queue.push({ id, mult, ct, cd });
        } else {
            enviarNow(id, mult, gameType, ct, cd);
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

    // ── Intercepta console.log ────────────────────────────────────────────
    const _log = console.log.bind(console);
    console.log = function () {
        _log.apply(console, arguments);
        try { Array.prototype.slice.call(arguments).forEach(verificarDados); } catch (e) {}
    };

    // ── Intercepta WebSocket ──────────────────────────────────────────────
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
        PatchedWS.OPEN       = OrigWS.OPEN;
        PatchedWS.CLOSING    = OrigWS.CLOSING;
        PatchedWS.CLOSED     = OrigWS.CLOSED;
        window.WebSocket = PatchedWS;
    }

    console.info('[AviatorBot] v3.5 | ' + (isTop ? 'pai' : 'filho aguardando jogo...'));
})();
