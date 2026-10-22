// Muevo Review · aviso de erros das páginas
// Manda para o servidor os erros de script desta página (no máximo 3 por visita), para a equipe da Muevo saber antes
// do cliente reclamar. Só erros dos arquivos do próprio site; queda de internet e extensões do navegador ficam de fora.
// Nada de dado do cliente vai junto: o servidor ainda limpa e-mails e códigos antes de guardar.
(function(){
  "use strict";
  var API = String(window.MUEVO_API || "").trim(), enviados = 0, vistos = {};
  var p = location.pathname.split("/").pop().replace(/\.html$/, "");
  var PAGINA = { "": "revisao", index: "revisao", painel: "painel", pasta: "pasta", login: "login", conta: "conta", google: "google" }[p] || "";
  if (!API || !PAGINA) return;
  var REDE = /Failed to fetch|NetworkError|Load failed|network|AbortError|aborted|timeout|Network request failed/i;
  function manda(mensagem, onde){
    var m = String(mensagem || "").slice(0, 300), chave = m + "|" + onde;
    if (!m || enviados >= 3 || vistos[chave] || REDE.test(m)) return;
    vistos[chave] = 1; enviados++;
    try {
      fetch(API, { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ acao: "erro_pagina", pagina: PAGINA, mensagem: m, onde: String(onde || "").slice(0, 200) }) }).catch(function(){});
    } catch (e) {}
  }
  window.addEventListener("error", function(e){
    var f = String(e.filename || "");
    if (f && f.indexOf(location.origin) !== 0) return;          // extensão do navegador ou outro site
    if (/^Script error\.?$/i.test(String(e.message || "")) || !e.error) return;   // erro de fora, sem detalhe
    manda(e.message || "erro", (f ? f.replace(location.origin, "") : location.pathname) + ":" + (e.lineno || 0));
  });
  window.addEventListener("unhandledrejection", function(e){
    var r = e.reason, m = r && r.message ? r.message : String(r || "");
    var pilha = String((r && r.stack) || "").split("\n").filter(function(l){ return l.indexOf(location.origin) >= 0; })[0] || "";
    if (!pilha && r && r.stack) return;                    // veio de fora do site
    manda("Promessa recusada: " + m, pilha.replace(location.origin, "").trim());
  });
})();
