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
    // logo só branco ou só preto: marca a imagem para ela inverter no fundo em que sumiria
    // (branco no modo claro vira preto; preto no modo escuro vira branco). Logos coloridos ficam como estão.
    // A análise usa uma cópia da imagem com CORS; se não der para ler, nada muda.
    tomDoLogo(img){
      const src = img.currentSrc || img.src; if (!src) return;
      const a = new Image(); a.crossOrigin = "anonymous";
      a.onload = () => { try {
        const W = 64, H = Math.max(1, Math.round(64 * a.naturalHeight / Math.max(1, a.naturalWidth)));
        const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(a, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
        let n = 0, claros = 0, escuros = 0;
        for (let i = 0; i < d.length; i += 4){ if (d[i+3] < 128) continue; n++;
          const mx = Math.max(d[i], d[i+1], d[i+2]), mn = Math.min(d[i], d[i+1], d[i+2]), sat = mx ? (mx - mn) / mx : 0;
          if (sat < .18 && mn > 205) claros++; else if (sat < .25 && mx < 60) escuros++; }
        if (n < 20 || n > W * H * .92) return;   // quase sem desenho, ou imagem sem fundo transparente: deixa como está
        img.classList.toggle("logo-branco", claros / n > .9);
        img.classList.toggle("logo-preto", escuros / n > .9);
      } catch(e){} };
      a.src = src + (/^data:/.test(src) ? "" : (src.includes("?") ? "&" : "?") + "cors=1");
    },
  };
})();
