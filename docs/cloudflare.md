# Execução em Cloudflare Workers

O frontend continua sendo o app da pasta `frota/`, incluindo clientes, viagens,
cadastro em etapas, diárias, permissões e funcionamento offline. A pasta
`cloudflare/` fornece a API JavaScript para Workers e usa PostgreSQL pelo driver
serverless do Neon. A branch `cloudflare-workers`, revisão
`90742f50db92e36db2636b96edb60b10e213264f`, foi usada como referência de infraestrutura.
As regras e o esquema foram adaptados à versão atual do app, sem trocar seu frontend.

## Preparar e verificar

Na pasta `cloudflare/`:

```sh
npm ci
npm run build
npm test
npm run check
```

`npm test` usa PostgreSQL descartável em memória, sem Neon. `npm run check`
compila com Wrangler em modo `--dry-run`, sem publicar. O build copia apenas
arquivos públicos permitidos para `cloudflare/public/`: scripts, estilos,
ícones, service worker e o HTML gerado a partir do app atual. PHP, SQLite,
uploads locais, credenciais e os dados fictícios da prévia não entram no pacote.

## Configurar a hospedagem

Na conta Cloudflare escolhida para o cliente, configure os segredos:

```sh
npx wrangler login
npx wrangler secret put DATABASE_URL
npx wrangler secret put FROTA_ADMIN_SENHA
```

A conexão PostgreSQL deve ter SSL. A senha inicial é usada somente quando ainda
não existe proprietário; usuários existentes e hashes bcrypt do PHP são mantidos.
Para iniciar um banco vazio, a senha inicial precisa ter pelo menos oito caracteres.
Depois da configuração, `npm run deploy` publica o Worker e os arquivos públicos.
Nenhum desses comandos de publicação foi executado nesta revisão.

Para desenvolvimento no Wrangler, use `.dev.vars` com esses mesmos nomes. Esse
arquivo é ignorado pelo Git. O serviço de prévia PHP continua independente, com
seu SQLite local e sem conexão automática ao Neon.

## Compatibilidade e consistência

- As URLs `api.php`, `manifest.php` e `index.php` continuam válidas.
- O esquema PostgreSQL vem das definições atuais do PHP, versão 5. A migração
  preserva o histórico e importa clientes antigos sem duplicar variações de caixa.
- Sessões têm cookies HttpOnly/SameSite e ficam no banco; senhas existentes
  permanecem compatíveis. Motoristas conservam o prazo de dois minutos.
- Operações compostas e os recibos da fila são confirmados na mesma transação.
  Reenvios não duplicam viagens, anexos ou pagamentos. Pagamentos usam bloqueios
  para evitar alterações concorrentes no mesmo saldo.
- Notas e comprovantes ficam autenticados na API e são guardados em BYTEA.
- Cache, sessão offline e fila são separados por banco/ambiente.
- Arquivos estáticos usam Assets; as rotas dinâmicas passam pelo Worker.
- A Receita dos motoristas limita a consulta ao mês atual e anterior, sem PDF.

No iPhone, a sincronização é retomada ao abrir ou retornar ao app. O sistema não
depende de execução em segundo plano para confirmar os cadastros.

Referências: [Assets](https://developers.cloudflare.com/workers/static-assets/),
[AsyncLocalStorage](https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/)
e [driver Neon](https://neon.com/docs/serverless/serverless-driver).
