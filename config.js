window.MUEVO_API = "https://script.google.com/macros/s/AKfycby111fjFg_UlbWQoob-zF4MsCILZz8QhhR_497qRSPmnfhoOUez5TB-4eCufypcpoLZpA/exec";
// Chave da API do Google (só leitura do Drive), travada para o domínio do site no Google Cloud.
window.MUEVO_GKEY = "AIzaSyCimZtm1XW-pavwp9Tz0XGlxErdNcRNJAo";
// Login do Google (só para escolher vídeos do Drive). Acesso apenas aos arquivos que a pessoa escolher.
window.MUEVO_GCLIENT = "276045456946-hbo9u7qggttd5tg23cdrlto26mqirjuv.apps.googleusercontent.com";
window.MUEVO_GAPPID = "276045456946";

// Endereço público do R2 (o mesmo que aparece nos links das prévias). As páginas do cliente leem daqui
// uma cópia da ficha e abrem na hora, sem esperar a planilha. Vazio = desligado.
window.MUEVO_R2_PUBLICO = "https://pub-7c7106d5e0644c66a3aa41fb8aea86bd.r2.dev";

// ---------- modo de teste do servidor novo (Supabase) ----------
// Desligado para todo mundo. Liga só no navegador de quem abrir teste-api.html e clicar em "Ligar".
// Ligado: as leituras (painel, arquivo, pasta, quem sou eu, sininho) vão para o servidor novo;
// o resto continua no Apps Script. A sessão sai do endereço e vai no cabeçalho, como o servidor novo exige.
// Transitório: sai quando a troca terminar.
(function () {
  const ANTIGA = window.MUEVO_API, NOVA = "https://gfejhvmbdbepldgubrkl.supabase.co/functions/v1/api";
  let ligado = false;
  try { ligado = localStorage.getItem("muevo-api") === "nova"; } catch (e) {}
  if (!ligado) return;
  window.MUEVO_API = NOVA;
  window.MUEVO_API_TESTE = true;
  const PRONTAS = new Set(["eu", "notificacoes"]);
  const original = window.fetch.bind(window);
  window.fetch = function (entrada, op) {
    const url = typeof entrada === "string" ? entrada : "";
    if (url.indexOf(NOVA) !== 0) return original(entrada, op);
    op = Object.assign({}, op);
    if (String(op.method || "GET").toUpperCase() === "POST") {
      let acao = "";
      try { acao = JSON.parse(op.body || "{}").acao; } catch (e) {}
      return original(PRONTAS.has(acao) ? url : ANTIGA, op);
    }
    const u = new URL(url), h = new Headers(op.headers || {});
    const s = u.searchParams.get("sessao"), c = u.searchParams.get("chave");
    if (s) { h.set("Authorization", "Bearer " + s); u.searchParams.delete("sessao"); }
    if (c) { h.set("x-chave", c); u.searchParams.delete("chave"); }
    op.headers = h;
    return original(u.toString(), op);
  };
  document.addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("a");
    b.href = "teste-api.html"; b.textContent = "Servidor novo";
    b.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:99999;font:600 11px/1 system-ui,sans-serif;padding:6px 9px;border-radius:999px;background:#E8F5EC;color:#1F6B3A;text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,.15)";
    document.body.appendChild(b);
  });
})();
