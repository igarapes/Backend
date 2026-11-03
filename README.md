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
