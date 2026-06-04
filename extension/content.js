// Betudo Aviator Collector v3.1 — Aviator 1 e Aviator VIP via postMessage
(function () {
    if (window.__aviatorBotInstalled) return;
    window.__aviatorBotInstalled = true;

    const RAILWAY_URL = 'https://betudo-capture-production.up.railway.app/collect';
    const API_KEY = 'betudo2024';
    const seenRounds = new Set();
    let gameType = null;

    // ── Detecta pelo URL do próprio frame
    const selfUrl = window.location.href;
    if (selfUrl.includes('aviator-vip')) gameType = 'vip';
    else if (selfUrl.includes('aviator')) gameType = 'aviator';

    // ── Recebe tipo de jogo do frame pai (caso seja iframe cross-origin)
    window.addEventListener('message', function(e) {
        if (e.data && typeof e.data === 'object' && e.data.__aviatorBotGame) {
            gameType = e.data.__aviatorBotGame;
            console.info('[AviatorBot] jogo recebido do pai: ' + gameType);
        }
    });

    // ── Se for o frame principal, informa os iframes filhos
    if (window === window.top) {
        const topGame = selfUrl.includes('aviator-vip') ? 'vip' : 'aviator';
        gameType = topGame;

        function tellChildren() {
            document.querySelectorAll('iframe').forEach(f => {
                try { f.contentWindow.postMessage({ __aviatorBotGame: topGame }, '*'); } catch(e) {}
            });
        }
        // Dispara múltiplas vezes para pegar iframes que ainda estão carregando
        [200, 500, 1000, 2000, 4000].forEach(t => setTimeout(tellChildren, t));
        // Também avisa ao carregar novos iframes
        new MutationObserver(tellChildren).observe(document, { childList: true, subtree: true });
    }

    function getGame() { return gameType || 'aviator'; }

    function enviarRound(roundId, maxMultiplier) {
        const id = Number(roundId);
        const mult = Number(maxMultiplier);
        if (!id || !mult || mult <= 0) return;
        const game = getGame();
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

    const _log = console.log.bind(console);
    console.log = function () {
        _log.apply(console, arguments);
        try { Array.prototype.slice.call(arguments).forEach(verificarDados); } catch (e) {}
    };

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

    console.info('[AviatorBot] v3.1 | frame: ' + (window === window.top ? 'pai' : 'filho') + ' | jogo: ' + getGame());
})();
