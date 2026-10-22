// Muevo Review · cor da marca do estúdio nas páginas do cliente (revisão e pasta).
// Recebe a cor principal (#rrggbb) e monta a família: o tom claro do degradê dos botões, o tom do texto destacado
// (mais escuro no modo claro e mais claro no escuro, para ler bem) e a cor do texto em cima do botão (branco ou preto).
(function(){
  "use strict";
  const hex = c => /^#[0-9a-f]{6}$/i.test(String(c||"")) ? String(c).toLowerCase() : "";
  const rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16));
  const para = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mistura = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  // luminância relativa (WCAG), para escolher o texto do botão e acertar o contraste do texto destacado
  const lum = a => { const c = a.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  // escurece (ou clareia) até ler bem sobre o fundo dado
  function legivel(base, fundo, alvo, rumo){ let c = base; for (let i = 0; i < 20 && contraste(c, fundo) < alvo; i++) c = mistura(c, rumo, .12); return c; }

  function cores(h){
    const c = rgb(h), branco = [255,255,255], preto = [0,0,0];
    return {
      accent: h,
      accent2: para(mistura(c, branco, .22)),
      inkClaro: para(legivel(c, [231,231,229], 4.5, preto)),
      inkEscuro: para(legivel(mistura(c, branco, .12), [23,23,22], 4.5, branco)),
      on: contraste(c, branco) >= 3 ? "#ffffff" : "#111111",
      rgb: c.join(","),
    };
  }

  window.MuevoCor = {
    aplica(cor){
      const h = hex(cor); let st = document.getElementById("marca-cor");
      if (!h){ if (st) st.remove(); return; }
      const k = cores(h);
      if (!st){ st = document.createElement("style"); st.id = "marca-cor"; document.head.appendChild(st); }
      st.textContent =
        ":root{--accent:" + k.accent + ";--accent-2:" + k.accent2 + ";--accent-ink:" + k.inkClaro + ";--on-accent:" + k.on + ";--accent-rgb:" + k.rgb + "}" +
        "@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){--accent-ink:" + k.inkEscuro + "}}" +
        ":root[data-theme=\"dark\"]{--accent-ink:" + k.inkEscuro + "}";
    },
    cores: h => hex(h) ? cores(hex(h)) : null,
  };
})();
