# Backend

## HTTPS (TLS) em produção

O TLS termina no proxy da plataforma de deploy (Render, Railway, Nginx etc.), que tem o certificado.
A API recebe as requisições por HTTP dentro da rede interna do proxy:

```
Navegador ──HTTPS──▶ Proxy (certificado TLS) ──HTTP──▶ API (Express)
```

Proteções no código, ativas quando `NODE_ENV=production`:

| Proteção | Onde | O que faz |
|---|---|---|
| `trust proxy` | `src/server.ts` | Confia no `X-Forwarded-Proto`/`X-Forwarded-For` do proxy, para o Express saber se a requisição original foi HTTPS e qual o IP real do cliente. Desligado fora de produção para ninguém forjar esses cabeçalhos. |
| Redirecionamento HTTP → HTTPS | `src/shared/middleware/requireHttps.ts` | Responde `308` para a mesma URL em `https://`. O 308 mantém o método e o corpo da requisição. |
| HSTS | `helmet()` em `src/server.ts` | Depois da primeira visita, o navegador só acessa a API por HTTPS. |
| Cookie `secure` | `src/modules/auth/auth.controller.ts` | O cookie do token só trafega por HTTPS. |

### Configuração no deploy

- `NODE_ENV=production`
- `DATABASE_URL` com `?sslmode=require`, para a conexão com o Postgres também ser criptografada
- `URL_FRONT` com a URL do frontend em `https://` (única origem liberada no CORS em produção)
- No frontend, `VITE_API_BASE_URL` também precisa começar com `https://`
- Se a plataforma fizer health check por HTTP direto (sem passar pelo proxy), criar uma rota de health check e liberá-la no `requireHttps`

## Testes

```bash
npm test               # roda todos os testes
npm run test:coverage  # com relatório de cobertura
```

Os testes **nunca usam o banco de desenvolvimento**. Fora do CI, eles usam o mesmo Postgres do `DATABASE_URL`,
mas com o banco `<nome>_test` (ex.: `igarapesdb` → `igarapesdb_test`):

- o banco de teste é criado e migrado automaticamente antes dos testes (`test/globalSetup.ts`);
- cada arquivo de teste começa com o banco vazio e cria os próprios dados (`test/helpers/factory.ts`), sem depender do seed;
- se a URL escolhida não for de um banco cujo nome contenha `test`, os testes param antes de apagar qualquer coisa (`test/helpers/testDatabase.ts`);
- para usar outro banco de teste, defina `TEST_DATABASE_URL`;
- no CI (`CI=true`), o `DATABASE_URL` é usado como está, porque o banco do pipeline já é descartável.

Nenhum teste acessa a internet: a API de senhas vazadas (Have I Been Pwned) é simulada em `test/setup.ts`.
