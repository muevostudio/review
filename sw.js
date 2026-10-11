// Muevo Review · ajudante de download
// Recebe o arquivo original direto do Google Drive e entrega ao navegador com o nome original,
// sem a página de "verificação de vírus" do Drive. O arquivo passa em pedaços, sem ficar inteiro na memória.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || !u.pathname.endsWith("/__baixar")) return;
  e.respondWith((async () => {
    const id = u.searchParams.get("id") || "", key = u.searchParams.get("key") || "";
    const nome = (u.searchParams.get("nome") || "video").replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 200);
    const reserva = u.searchParams.get("reserva") || "";
    if (!/^[A-Za-z0-9_-]{10,120}$/.test(id)) return new Response("arquivo inválido", { status: 400 });
    const api = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?alt=media&supportsAllDrives=true&key=" + encodeURIComponent(key);
    let r;
    try { r = await fetch(api); } catch (err) { r = null; }
    if (!r || !r.ok) {
      // o Drive não liberou por aqui: manda para o download comum do Drive
      if (/^https:\/\/drive\.usercontent\.google\.com\//.test(reserva)) return Response.redirect(reserva, 302);
      return new Response("Não foi possível baixar agora.", { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    const h = new Headers();
    h.set("Content-Type", r.headers.get("Content-Type") || "application/octet-stream");
    h.set("Content-Disposition", "attachment; filename=\"" + nome.replace(/[^\x20-\x7E]/g, "_") + "\"; filename*=UTF-8''" + encodeURIComponent(nome));
    const tam = r.headers.get("Content-Length");
    if (tam) h.set("Content-Length", tam);
    return new Response(r.body, { status: 200, headers: h });
  })());
});
