// Betudo Aviator Collector — Content Script
// Roda em https://www.betudo.bet/* (todos os frames, incluindo iframe da Spribe)

(function () {
    if (window.__aviatorBotInstalled) return;
    window.__aviatorBotInstalled = true;

    const RAILWAY_URL = 'https://betudo-capture-production.up.railway.app/collect';
    const API_KEY = 'betudo2024';

    const seenRounds = new Set();

    function enviarRound(roundId, maxMultiplier) {
        const id = Number(roundId);
        const mult = Number(maxMultiplier);
        if (!id || !mult) return;
        if (seenRounds.has(id)) return;
        seenRounds.add(id);

        fetch(RAILWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, roundId: id, maxMultiplier: mult })
        })
        .then(r => r.json())
        .then(d => console.log('[AviatorBot] Round ' + id + ' | ' + mult + 'x | ok=' + d.saved))
        .catch(e => console.warn('[AviatorBot] Erro ao enviar round:', e));
    }

    // Intercepta console.log para capturar mensagens do jogo
    const _log = console.log.bind(console);
    console.log = function () {
        _log.apply(console, arguments);
        try {
            const args = Array.prototype.slice.call(arguments);
            for (let i = 0; i < args.length; i++) {
                const a = args[i];

                // Objeto direto com roundId + maxMultiplier
                if (a && typeof a === 'object' && 'maxMultiplier' in a && 'roundId' in a) {
                    enviarRound(a.roundId, a.maxMultiplier);
                    return;
                }

                // String JSON ou texto com as chaves
                if (typeof a === 'string' && a.includes('maxMultiplier')) {
                    try {
                        const p = JSON.parse(a);
                        if ('maxMultiplier' in p && 'roundId' in p) {
                            enviarRound(p.roundId, p.maxMultiplier);
                            return;
                        }
                    } catch (e) {}
                    const mr = a.match(/roundId[^\d]*(\d+)/);
                    const mm = a.match(/maxMultiplier[^\d]*([\d.]+)/);
                    if (mr && mm) enviarRound(mr[1], mm[1]);
                }
            }
        } catch (e) {}
    };

    console.log('[AviatorBot] Extensão ativa em', window.location.href);
})();
