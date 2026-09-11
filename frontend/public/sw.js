/**
 * Service Worker para Upload em Segundo Plano
 * 
 * Usa a Background Fetch API para continuar uploads mesmo quando:
 * - O usuário troca de app (Instagram, WhatsApp)
 * - O usuário bloqueia a tela do celular
 * - O navegador vai para segundo plano no Android
 */

const SW_VERSION = "2.1.0";
const BC_CHANNEL_NAME = "analu-upload-channel";

function broadcast(data) {
  try {
    const bc = new BroadcastChannel(BC_CHANNEL_NAME);
    bc.postMessage(data);
    bc.close();
  } catch (e) {}
}

// Quando o background fetch termina com SUCESSO
self.addEventListener("backgroundfetchsuccess", (event) => {
  const bgFetch = event.registration;

  event.waitUntil(
    (async () => {
      try {
        const records = await bgFetch.matchAll();

        let allOk = true;
        let failedCount = 0;

        for (const record of records) {
          try {
            const response = await record.responseReady;
            if (!response.ok) {
              allOk = false;
              failedCount++;
            }
          } catch (e) {
            allOk = false;
            failedCount++;
          }
        }

        // Finaliza qualquer arquivo pendente no manifesto
        try {
          const cache = await caches.open("upload-manifest");
          const manifestRes = await cache.match(`/_manifest/${bgFetch.id}`);
          if (manifestRes) {
            const manifest = await manifestRes.json();
            for (const item of manifest) {
              await fetch("/api/upload-complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item),
              }).catch(() => {});
            }
            await cache.delete(`/_manifest/${bgFetch.id}`);
          }
        } catch (e) {}

        if (allOk) {
          event.updateUI({ title: "✅ Mídias enviadas com sucesso!" });
        } else {
          event.updateUI({ title: `⚠️ Envio concluído com ${failedCount} avisos` });
        }

        // Notifica abas abertas
        broadcast({
          type: "BG_FETCH_COMPLETE",
          id: bgFetch.id,
          success: allOk,
          failedCount,
        });

        // Salva estado para abas que reabrirem depois
        try {
          const stateCache = await caches.open("upload-state");
          await stateCache.put(
            new Request(`/_upload-state/${bgFetch.id}`),
            new Response(
              JSON.stringify({
                completed: true,
                success: allOk,
                failedCount,
                timestamp: Date.now(),
              })
            )
          );
        } catch (e) {}
      } catch (err) {
        console.error("[SW] Erro no backgroundfetchsuccess:", err);
      }
    })()
  );
});

// Quando o background fetch FALHA
self.addEventListener("backgroundfetchfailure", (event) => {
  const bgFetch = event.registration;

  event.waitUntil(
    (async () => {
      event.updateUI({ title: "⚠️ Erro no envio — reabra o site para continuar" });

      broadcast({
        type: "BG_FETCH_FAILED",
        id: bgFetch.id,
        failureReason: bgFetch.failureReason,
      });

      try {
        const stateCache = await caches.open("upload-state");
        await stateCache.put(
          new Request(`/_upload-state/${bgFetch.id}`),
          new Response(
            JSON.stringify({
              completed: true,
              success: false,
              failureReason: bgFetch.failureReason,
              timestamp: Date.now(),
            })
          )
        );
      } catch (e) {}
    })()
  );
});

// Quando o usuário clica na notificação do background fetch
self.addEventListener("backgroundfetchclick", (event) => {
  event.waitUntil(clients.openWindow("/"));
});

// Quando o background fetch é abortado pelo usuário
self.addEventListener("backgroundfetchabort", (event) => {
  const bgFetch = event.registration;
  broadcast({
    type: "BG_FETCH_ABORTED",
    id: bgFetch.id,
  });
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
