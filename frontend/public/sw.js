/**
 * Service Worker para Upload em Segundo Plano
 * 
 * Usa a Background Fetch API para continuar uploads mesmo quando:
 * - O usuário troca de app (Instagram, WhatsApp)
 * - O usuário bloqueia a tela do celular
 * - O navegador vai para segundo plano no Android
 * 
 * Background Fetch é a ÚNICA API web que sobrevive à suspensão
 * do processo do browser no Android.
 */

const SW_VERSION = "2.0.0";

// BroadcastChannel para comunicar com a página
const BC_CHANNEL_NAME = "analu-upload-channel";

function broadcast(data) {
  try {
    const bc = new BroadcastChannel(BC_CHANNEL_NAME);
    bc.postMessage(data);
    bc.close();
  } catch (e) {
    // BroadcastChannel pode não estar disponível em todos os contextos
  }
}

// Quando o background fetch termina com SUCESSO
self.addEventListener("backgroundfetchsuccess", (event) => {
  const bgFetch = event.registration;
  
  event.waitUntil(
    (async () => {
      try {
        const records = await bgFetch.matchAll();
        
        // Verifica as respostas - cada chunk já foi enviado com sucesso
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
        
        // Atualiza a UI da notificação do browser
        if (allOk) {
          event.updateUI({ title: "✅ Mídias enviadas com sucesso!" });
        } else {
          event.updateUI({ title: `⚠️ ${failedCount} chunks falharam` });
        }
        
        // Notifica a página (se estiver aberta)
        broadcast({
          type: "BG_FETCH_COMPLETE",
          id: bgFetch.id,
          success: allOk,
          failedCount,
        });
        
        // Salva estado no cache para quando a página reabrir
        try {
          const cache = await caches.open("upload-state");
          await cache.put(
            new Request(`/_upload-state/${bgFetch.id}`),
            new Response(JSON.stringify({
              completed: true,
              success: allOk,
              failedCount,
              timestamp: Date.now(),
            }))
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
      event.updateUI({ title: "⚠️ Erro ao enviar mídias — reabra o site para tentar novamente" });
      
      broadcast({
        type: "BG_FETCH_FAILED",
        id: bgFetch.id,
        failureReason: bgFetch.failureReason,
      });
      
      try {
        const cache = await caches.open("upload-state");
        await cache.put(
          new Request(`/_upload-state/${bgFetch.id}`),
          new Response(JSON.stringify({
            completed: true,
            success: false,
            failureReason: bgFetch.failureReason,
            timestamp: Date.now(),
          }))
        );
      } catch (e) {}
    })()
  );
});

// Quando o usuário clica na notificação do background fetch
self.addEventListener("backgroundfetchclick", (event) => {
  event.waitUntil(
    clients.openWindow("/")
  );
});

// Quando o background fetch é abortado pelo usuário
self.addEventListener("backgroundfetchabort", (event) => {
  const bgFetch = event.registration;
  broadcast({
    type: "BG_FETCH_ABORTED",
    id: bgFetch.id,
  });
});

// Install e Activate padrão
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Não intercepta nenhum fetch — o SW existe apenas para Background Fetch
// self.addEventListener("fetch", ...) intencionalmente omitido
