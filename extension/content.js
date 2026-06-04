// Betudo Aviator Collector v3 — suporte a Aviator 1 e Aviator VIP
(function () {
    if (window.__aviatorBotInstalled) return;
    window.__aviatorBotInstalled = true;

    const RAILWAY_URL = 'https://betudo-capture-production.up.railway.app/collect';
    const API_KEY = 'betudo2024';
    const seenRounds = new Set();

    // Detecta qual jogo verificando URL atual, da página pai e do referrer
    function getGame() {
        const urls = [
            window.location.href,
            document.referrer || '',
            (() => { try { return window.top.location.href; } catch(e) { return ''; } })()
        ];
        return urls.some(u => u.includes('aviator-vip')) ? 'vip' : 'aviator';
    }

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

    console.info('[AviatorBot] v3.0 | jogo: ' + getGame() + ' | ' + window.location.href);
})();
