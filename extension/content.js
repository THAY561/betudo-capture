// Betudo Aviator Collector v2.2 — só captura no Aviator 1 (bloqueia VIP)

(function () {
    // Bloqueia se for VIP (tanto no frame pai quanto no iframe)
    const topHref = (() => { try { return window.top.location.href; } catch(e) { return document.referrer; } })();
    if (topHref.includes('aviator-vip')) return;

    if (window.__aviatorBotInstalled) return;
    window.__aviatorBotInstalled = true;

    const RAILWAY_URL = 'https://betudo-capture-production.up.railway.app/collect';
    const API_KEY = 'betudo2024';
    const seenRounds = new Set();

    function enviarRound(roundId, maxMultiplier) {
        const id = Number(roundId);
        const mult = Number(maxMultiplier);
        if (!id || !mult || mult <= 0) return;
        if (seenRounds.has(id)) return;
        seenRounds.add(id);

        // Envia horário do navegador do cliente (mais preciso que o servidor)
        const now = new Date();
        const clientTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const clientDate = now.toLocaleDateString('pt-BR');

        fetch(RAILWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, roundId: id, maxMultiplier: mult, clientTime, clientDate })
        })
        .then(r => r.json())
        .then(() => console.info('[AviatorBot] ✓ Round ' + id + ' | ' + mult + 'x | ' + clientTime))
        .catch(() => {});
    }

    function verificarDados(a) {
        if (!a) return;

        // Objeto direto com roundId + maxMultiplier
        if (typeof a === 'object' && 'maxMultiplier' in a && 'roundId' in a) {
            enviarRound(a.roundId, a.maxMultiplier);
            return;
        }

        // String JSON
        if (typeof a === 'string' && a.includes('maxMultiplier')) {
            try {
                const p = JSON.parse(a);
                if ('maxMultiplier' in p && 'roundId' in p) {
                    enviarRound(p.roundId, p.maxMultiplier);
                    return;
                }
            } catch (e) {}
            // Regex como fallback
            const mr = a.match(/roundId[^\d]*(\d+)/);
            const mm = a.match(/maxMultiplier[^\d]*([\d.]+)/);
            if (mr && mm) enviarRound(mr[1], mm[1]);
        }
    }

    // ── 1. Intercepta console.log da página real ───────────────────────────
    const _log = console.log.bind(console);
    console.log = function () {
        _log.apply(console, arguments);
        try {
            Array.prototype.slice.call(arguments).forEach(verificarDados);
        } catch (e) {}
    };

    // ── 2. Intercepta WebSocket (canal principal do jogo Spribe) ───────────
    const OrigWS = window.WebSocket;
    if (OrigWS) {
        function PatchedWS(url, protocols) {
            const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
            ws.addEventListener('message', function (event) {
                try {
                    if (typeof event.data !== 'string') return;
                    if (!event.data.includes('maxMultiplier') && !event.data.includes('roundId')) return;

                    const data = JSON.parse(event.data);
                    // Verifica objeto raiz e campos aninhados
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

    console.info('[AviatorBot] v2.2 ativo em ' + window.location.href);
})();
