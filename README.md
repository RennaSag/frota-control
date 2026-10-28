<div align="center">

<img src="frota/assets/logo-512.png" alt="Logo" width="140">

# Controle da Frota

**Sistema web para controlar fretes, gastos, viagens e diárias de uma empresa de caminhões.**
Feito para o motorista registrar tudo pelo celular, na estrada, mesmo sem sinal, e para o
proprietário acompanhar o resultado da frota em tempo real.

![PHP](https://img.shields.io/badge/PHP-8.x-777BB4?style=flat-square&logo=php&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-sem%20framework-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-funciona%20offline-5A0FC8?style=flat-square&logo=pwa&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

[Funcionalidades](#funcionalidades) ·
[Funciona sem internet](#funciona-sem-internet) ·
[Tecnologias](#tecnologias) ·
[Como rodar](#como-rodar) ·
[Manual de uso](frota/README.md)

</div>

---

## Sobre o projeto

Numa transportadora pequena, o controle financeiro costuma ficar espalhado em cadernos, notas
amassadas e mensagens de WhatsApp. O **Controle da Frota** junta tudo num só lugar:

- o **motorista** lança cada gasto na hora (abastecimento, pedágio, manutenção), com a foto da
  nota, e registra suas viagens e dias trabalhados;
- o **proprietário** vê entradas e saídas, o saldo de cada caminhão e de cada viagem, quanto os
  clientes ainda devem e quanto falta pagar aos motoristas.

O sistema roda no navegador do computador e do celular (Android e iPhone) e pode ser
**instalado como aplicativo**, sem passar por loja.

## Funcionalidades

### Para o motorista

- Registro de gastos em poucos toques, com a foto do cupom ou da nota
- No abastecimento, litros e km, com o preço por litro calculado na hora
- Abertura e encerramento de viagens (origem, destino, km de saída e de chegada)
- Envio de notas fiscais dos clientes (foto ou PDF)
- Registro dos dias trabalhados, com o total a receber de diárias
- Consulta da receita da empresa (só leitura)
- **5 minutos** para corrigir ou apagar o que registrou; depois disso, só o proprietário altera

### Para o proprietário

- **Panorama** do mês ou de qualquer período: saldo comparado ao período anterior, gráficos
  mês a mês, gastos por categoria, por motorista e por tipo de frete
- **Desempenho de cada caminhão**: entradas, saídas, saldo, combustível, R$/litro e km/litro
- **Lançamentos** com filtros por mês, tipo, motorista, caminhão e categoria
- **Fretes a receber**: valor combinado, pagamentos parciais, vencidos e situação de cada frete
- **Diárias**: dias trabalhados por motorista, pagamento em um toque (vira um gasto automaticamente)
- **Relatórios em PDF** do panorama e dos lançamentos
- **Central de avisos** com tudo o que os motoristas registram, editam ou excluem
- Cadastros de motoristas, caminhões e categorias

### Níveis de acesso

| | Motorista | Proprietário |
|---|:---:|:---:|
| Lançar gastos e abrir viagens | sim | sim |
| Lançar entradas (fretes) | não | sim |
| Ver lançamentos | só os próprios | todos |
| Editar ou excluir | o que registrou, por 5 minutos | tudo, a qualquer hora |
| Enviar notas fiscais e registrar diárias | sim | sim |
| Panorama, fretes a receber e cadastros | não | sim |

## Funciona sem internet

O sistema é um **PWA** (Progressive Web App) pensado para a realidade da estrada, onde o sinal
cai a todo momento.

- **Abre sem sinal**, mostrando os últimos dados vistos, com uma faixa avisando que está offline.
- **Nada se perde.** Gastos, viagens, notas fiscais (com a foto) e diárias registrados sem
  internet ficam guardados no aparelho e são **enviados sozinhos quando o sinal volta**, na ordem
  certa. Um gasto lançado numa viagem aberta sem sinal chega ao servidor já ligado a ela.
- **Sem duplicados.** Se a conexão cair no meio de um envio, o reenvio não grava o mesmo registro
  duas vezes.
- **Notificações push**, mesmo com o app fechado: o proprietário fica sabendo na hora quando um
  motorista registra algo, e o motorista é avisado quando recebe uma viagem ou o pagamento das diárias.
- **Atalhos no ícone** (registrar gasto, nova viagem, nota, diária) e **compartilhamento** de fotos
  e PDFs de outros apps direto para o sistema (Android).

```mermaid
flowchart LR
    A[Motorista registra o gasto] --> B{Tem internet?}
    B -- sim --> C[(Servidor)]
    B -- não --> D[Fila no aparelho<br/>IndexedDB]
    D -- sinal voltou --> C
    C --> E[Aviso push para o proprietário]
```

## Tecnologias

| Camada | Escolha |
|---|---|
| Back-end | PHP 8 puro, sem framework, com API JSON (`api.php?r=rota`) |
| Banco de dados | MySQL, PostgreSQL ou SQLite (o mesmo código atende os três) |
| Front-end | JavaScript puro, HTML e CSS, sem build e sem dependências |
| Gráficos e PDFs | Gerados no próprio sistema, sem bibliotecas externas |
| Aplicativo | PWA: manifest, service worker, IndexedDB, Background Sync e Badging API |
| Notificações | Web Push com VAPID (RFC 8291 e 8292) implementado em PHP, sem bibliotecas |
| Implantação | XAMPP, hospedagem compartilhada comum ou Docker (Render) |

Alguns cuidados do projeto:

- **Valores em centavos** (números inteiros), sem erros de arredondamento
- **Senhas com bcrypt**, sessão em cookie `HttpOnly` e `SameSite`, limite de tentativas de login
  e proteção contra CSRF
- **Regras de permissão no servidor**: a tela só mostra o que o servidor já decidiu
- **Migração automática do banco**: ao atualizar o sistema, as tabelas e colunas novas são
  criadas na primeira visita, sem perder dados
- **Fotos reduzidas no celular** antes do envio e convertidas para WebP no servidor

## Como rodar

### Com XAMPP (Windows)

1. Instale o [XAMPP](https://www.apachefriends.org/pt_br/index.html) e inicie o **Apache** e o **MySQL**.
2. Copie a pasta `frota` para `C:\xampp\htdocs`.
3. Acesse **http://localhost/frota**. O banco e as tabelas são criados sozinhos.
4. Entre com o usuário `admin` e a senha `admin123`, e **troque a senha** em seguida.

### Com Docker

```bash
docker build -t controle-frota .
docker run -p 8080:80 \
  -e FROTA_BANCO=sqlite \
  -e FROTA_ADMIN_SENHA=troque-esta-senha \
  -v frota-dados:/var/www/html/dados \
  controle-frota
```

Depois acesse **http://localhost:8080**. Para usar PostgreSQL, troque `FROTA_BANCO` por
`-e DATABASE_URL=postgres://usuario:senha@servidor:5432/banco`.

### No Render

O arquivo [`render.yaml`](render.yaml) já descreve o serviço. Basta criar um Blueprint no Render
apontando para este repositório e preencher `DATABASE_URL` (PostgreSQL) e `FROTA_ADMIN_SENHA`.

> Para funcionar sem internet e receber notificações, o site precisa estar em **HTTPS**
> (ou em `localhost`). Pelo endereço de rede local (`http://192.168...`) o sistema abre
> normalmente, mas sem esses recursos.

### Variáveis de configuração

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | Endereço do PostgreSQL. Quando existe, o sistema usa PostgreSQL |
| `FROTA_BANCO` | Força o banco: `mysql`, `pgsql` ou `sqlite` |
| `FROTA_MYSQL_HOST`, `FROTA_MYSQL_PORTA`, `FROTA_MYSQL_BANCO`, `FROTA_MYSQL_USUARIO`, `FROTA_MYSQL_SENHA` | Conexão com o MySQL |
| `FROTA_SQLITE_ARQUIVO` | Caminho do arquivo SQLite |
| `FROTA_ADMIN_SENHA` | Senha inicial do usuário `admin` |
| `FROTA_PUSH_CONTATO` | Contato enviado junto das notificações (`mailto:seu@email.com`) |

Sem variáveis, valem os padrões de [`frota/config.php`](frota/config.php).

## Estrutura do projeto

```
frota/
├── index.php          página única que carrega o aplicativo
├── api.php            porta de entrada da API
├── manifest.php       dados do aplicativo instalável
├── sw.js              service worker: modo offline, fila de envio e notificações
├── config.php         configuração
├── src/
│   ├── banco.php      conexão e criação das tabelas (MySQL, PostgreSQL e SQLite)
│   ├── sessao.php     login, sessão e níveis de acesso
│   ├── rotas.php      todas as rotas da API
│   ├── push.php       notificações push (Web Push com VAPID)
│   ├── fila.php       proteção contra envios repetidos
│   ├── pdf.php        geração dos relatórios em PDF
│   └── util.php       validação dos campos
└── assets/
    ├── app.js         telas, formulários e gráficos
    ├── fila.js        fila de envios feitos sem internet
    └── estilo.css     aparência, pensada primeiro para o celular
```

## Documentação

O **[manual completo](frota/README.md)** explica o uso no dia a dia (motorista e proprietário),
o primeiro acesso, como colocar os celulares dos motoristas na rede e detalhes de implementação
para quem for mexer no código.
