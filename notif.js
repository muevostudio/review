// Muevo Review · sino de notificações da equipe (comentários de clientes)
// Uso: MuevoNotif.init({ host: <elemento onde o sino entra>, sessao: "<token>" })
(function(){
  const css = `
.nwrap{position:relative}
.nbtn{position:relative;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);display:grid;place-items:center;padding:0;cursor:pointer}
.nbtn:hover{border-color:var(--ink-3);color:var(--ink)}
.nbtn[aria-expanded="true"]{border-color:var(--ink);color:var(--ink)}
.nbadge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--accent);color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;border:2px solid var(--bg);line-height:1}
.nbadge[hidden]{display:none}
.npanel{position:absolute;right:0;top:calc(100% + 8px);width:min(380px,calc(100vw - 32px));max-height:min(520px,calc(100vh - 120px));background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.18);z-index:70;display:flex;flex-direction:column;overflow:hidden}
.npanel[hidden]{display:none}
.nhd{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 10px;border-bottom:1px solid var(--line-2)}
.nhd b{font-size:15px;font-weight:600;color:var(--ink)}
.nhd button{background:none;border:0;color:var(--ink-3);font-size:12.5px;text-decoration:underline;text-underline-offset:2px;cursor:pointer;padding:0}
.nlist{overflow:auto;display:flex;flex-direction:column}
.nitem{display:grid;grid-template-columns:8px minmax(0,1fr);gap:10px;padding:12px 16px;border-top:1px solid var(--line-2);text-decoration:none;color:var(--ink)}
.nitem:first-child{border-top:0}
.nitem:hover{background:var(--sunk)}
.nitem .ndot{width:8px;height:8px;border-radius:50%;margin-top:6px;background:transparent}
.nitem.novo .ndot{background:var(--accent)}
.nitem .nt{font-size:13.5px;line-height:1.35}
.nitem .nt b{font-weight:600}
.nitem .nq{font-size:13px;color:var(--ink-2);margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nitem .nm{font-size:11.5px;color:var(--ink-3);margin-top:4px}
.nvazio{padding:28px 16px;text-align:center;font-size:13.5px;color:var(--ink-3)}
`;
  const SINO = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>';
  function quando(iso){ const d=new Date(iso), m=Math.round((Date.now()-d)/60000);
    if (m<1) return "agora"; if (m<60) return "há "+m+" min"; if (m<1440) return "há "+Math.round(m/60)+" h";
    const dd=Math.round(m/1440); return dd<30 ? "há "+dd+(dd===1?" dia":" dias") : d.toLocaleDateString("pt-BR"); }
  function el(t,c,x){ const e=document.createElement(t); if(c) e.className=c; if(x!==undefined) e.textContent=x; return e; }

  function init(o){
    const API=(window.MUEVO_API||"").trim(); if (!API || !o.host || !o.sessao || init.feito) return; init.feito=true;
    if (!document.getElementById("muevo-notif-css")){ const st=el("style"); st.id="muevo-notif-css"; st.textContent=css; document.head.appendChild(st); }
    const wrap=el("div","nwrap"), btn=el("button","nbtn"), badge=el("span","nbadge"), panel=el("div","npanel");
    btn.type="button"; btn.innerHTML=SINO; btn.title="Notificações"; btn.setAttribute("aria-label","Notificações"); btn.setAttribute("aria-haspopup","dialog"); btn.setAttribute("aria-expanded","false");
    badge.hidden=true; btn.appendChild(badge);
    const hd=el("div","nhd"), tit=el("b","","Notificações"), lida=el("button","","Marcar tudo como lido"); lida.type="button";
    hd.append(tit, lida); const list=el("div","nlist"); panel.append(hd, list); panel.hidden=true;
    wrap.append(btn, panel); o.host.insertBefore(wrap, o.antes || o.host.firstChild);
    let itens=[], novos=0;
    const post=b=>fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(b)}).then(r=>r.json());
    function pinta(){
      badge.hidden=!novos; badge.textContent=novos>9?"9+":String(novos);
      btn.setAttribute("aria-label", novos ? novos+(novos===1?" notificação nova":" notificações novas") : "Notificações");
      lida.hidden=!novos; list.textContent="";
      if (!itens.length){ list.appendChild(el("div","nvazio","Nenhum comentário de cliente ainda.")); return; }
      itens.forEach(n=>{
        const a=el("a","nitem"+(n.novo?" novo":"")); a.href="index.html?j="+encodeURIComponent(n.token)+"&c="+encodeURIComponent(n.id);
        const tx=el("div"), t=el("div","nt"); t.append(el("b","",n.nome||"Alguém"), n.resposta?" respondeu em ":" comentou em ", el("b","",n.peca||n.projeto||"um vídeo"));
        tx.append(t);
        if (n.texto) tx.appendChild(el("div","nq","“"+n.texto+"”"));
        tx.appendChild(el("div","nm",[n.cliente, n.peca ? n.projeto : "", quando(n.criado_em)].filter(Boolean).join(" · ")));
        a.append(el("span","ndot"), tx); list.appendChild(a);
      });
    }
    async function carrega(){ try { const d=await post({acao:"notificacoes", sessao:o.sessao}); if (!d.ok) return; itens=d.itens||[]; novos=d.novos||0; pinta(); } catch(e){} }
    async function marcaLido(){ novos=0; itens.forEach(n=>n.novo=false); pinta(); try { await post({acao:"notif_visto", sessao:o.sessao}); } catch(e){} }
    const fecha=()=>{ if (panel.hidden) return; panel.hidden=true; btn.setAttribute("aria-expanded","false"); itens.forEach(n=>n.novo=false); pinta(); };
    // abrir a lista já conta como "visto": o número some, e os novos ficam com a bolinha laranja enquanto a lista estiver aberta
    btn.onclick=async e=>{ e.stopPropagation(); if (!panel.hidden){ fecha(); return; } panel.hidden=false; btn.setAttribute("aria-expanded","true");
      await carrega(); if (novos){ novos=0; pinta(); try { await post({acao:"notif_visto", sessao:o.sessao}); } catch(e){} } };
    lida.onclick=e=>{ e.stopPropagation(); marcaLido(); };
    panel.addEventListener("click", e=>e.stopPropagation());
    document.addEventListener("click", fecha);
    document.addEventListener("keydown", e=>{ if (e.key==="Escape") fecha(); });
    carrega();
    setInterval(()=>{ if (!document.hidden && panel.hidden) carrega(); }, 60000);
    document.addEventListener("visibilitychange", ()=>{ if (!document.hidden) carrega(); });
  }
  window.MuevoNotif = { init };
})();
