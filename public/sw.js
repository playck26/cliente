// Service worker do PlayCK.
//
// Até a SPEC-062 ele tinha três linhas e só existia para habilitar o prompt de
// instalação do PWA (ADR-012). Agora ele também recebe push.
//
// **Sem cache/offline** — continua fora de escopo. O `fetch` vazio é o que faz
// o navegador considerar o app instalável, e nada mais.
self.addEventListener("fetch", () => {});

// ---------------------------------------------------------------------------
// SPEC-062/D1a — push
// ---------------------------------------------------------------------------

/**
 * **`showNotification()` em TODO push, sem exceção.**
 *
 * Não é preferência de produto: o WebKit revoga a assinatura de quem recebe um
 * push e não mostra nada, e o Chrome mostra uma notificação genérica ("Este
 * site foi atualizado em segundo plano") no lugar. Ou seja, "push silencioso"
 * não existe aqui — existe push que custa a assinatura.
 *
 * Por isso o `catch` também mostra alguma coisa: se o corpo vier quebrado, é
 * melhor um aviso genérico do que a assinatura morrer.
 */
self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = {};
  }

  const titulo = dados.titulo || "Avisos do clube";
  const opcoes = {
    body: dados.corpo || "",
    // Os icones moram na RAIZ de `public/`, e nao em `public/icons/` — que
    // nem existe. O `manifest.ts` ja aponta para `/icon-192.png`; escrevi
    // `/icons/...` de memoria e o caminho quebrado so apareceria no primeiro
    // push real, como icone faltando na bandeja.
    icon: "/icon-192.png",
    badge: "/icon-maskable-192.png",
    // O destino da abertura viaja aqui, não na URL da notificação: é o
    // `notificationclick` quem decide para onde ir.
    data: { destinoUrl: dados.destinoUrl || "/" },
    // Avisos diferentes NÃO se substituem. Só o de teste usa tag fixa, porque
    // três testes seguidos empilhados na bandeja não ajudam ninguém.
    tag: dados.tipo === "teste" ? "playck-teste" : undefined,
  };

  // SPEC-065/D5 — **avisa as abas abertas, para o sino subir.**
  //
  // Este gancho nao existia: o `sw.js` mostrava a notificacao e as abas so
  // descobriam na proxima abertura. A aba que receber isto faz UM
  // `GET /me/avisos/nao-lidos`, com debounce e single-flight (AC-020).
  //
  // **Push de teste NAO mexe no contador** (AC-018): ele e diagnostico do
  // canal, nao recado do clube, e a caixa nao o mostra. Sem este `if`, o
  // numero subiria por um aviso que a pessoa nao encontraria ao abrir.
  const avisarAbas =
    dados.tipo === "teste"
      ? Promise.resolve()
      : self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((janelas) => {
            for (const janela of janelas) {
              janela.postMessage({ tipo: "playck:aviso-novo" });
            }
          })
          .catch(() => {
            // Avisar aba e conveniencia: falhar aqui nao pode impedir a
            // notificacao de aparecer, que e a obrigacao do WebKit.
          });

  evento.waitUntil(
    Promise.all([
      self.registration.showNotification(titulo, opcoes),
      avisarAbas,
    ]),
  );
});

/**
 * Tocar no aviso: **reaproveita a aba aberta** em vez de abrir outra.
 *
 * Quem tem o app instalado e toca num aviso espera voltar para o app, não
 * ganhar uma segunda instância dele com o estado perdido.
 */
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.destinoUrl) || "/";

  evento.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((janelas) => {
        for (const janela of janelas) {
          if ("focus" in janela) {
            if ("navigate" in janela && destino !== "/") {
              return janela.navigate(destino).then((j) => j && j.focus());
            }
            return janela.focus();
          }
        }
        return self.clients.openWindow(destino);
      }),
  );
});

/**
 * SPEC-062/D2a — o serviço de push pode trocar o `endpoint` sozinho.
 *
 * Quando isso acontece, a assinatura que o servidor guarda vira lixo e a pessoa
 * para de receber **sem nenhum sinal**. Este evento é o único aviso que o
 * navegador dá — e ele avisa as abas abertas, que reconciliam.
 *
 * **Não dá para registrar daqui**: o service worker não tem o token da sessão.
 * Por isso ele delega, e quem não tiver aba aberta reconcilia na próxima vez
 * que abrir o app (D2a-1).
 */
self.addEventListener("pushsubscriptionchange", (evento) => {
  evento.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        janela.postMessage({ tipo: "playck:reconciliar-push" });
      }
    }),
  );
});
