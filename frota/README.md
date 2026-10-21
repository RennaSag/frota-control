# Controle da Frota

Sistema web para controlar o dinheiro que entra (fretes) e o que sai (gastos) de uma
empresa de caminhões. Funciona no computador e no celular (Android e iPhone), pelo
navegador — não precisa instalar aplicativo.

## Os dois níveis de acesso

| | **Motorista** | **Proprietário** |
|---|---|---|
| Lançar gastos | sim | sim |
| Lançar entradas (fretes) | **não** | sim |
| Ver lançamentos | só os próprios | todos |
| Editar / excluir | só os próprios gastos | **tudo** |
| Panorama e relatórios | não | sim |
| Cadastros (motoristas, caminhões, categorias) | não | sim |

O motorista entra e já cai na tela de registrar gasto. Ele nunca vê o faturamento da
empresa nem os lançamentos dos outros motoristas.

---

## Instalação no XAMPP (Windows)

1. Instale o [XAMPP](https://www.apachefriends.org/pt_br/index.html).
2. Abra o **XAMPP Control Panel** e clique em **Start** no **Apache** e no **MySQL**.
3. Copie a pasta `frota` para dentro de `C:\xampp\htdocs`.
   O caminho deve ficar assim: `C:\xampp\htdocs\frota\index.php`.
4. No navegador, abra: **http://localhost/frota**

Na primeira vez que a página abrir, o sistema cria sozinho o banco de dados `frota`
e todas as tabelas. Não precisa mexer no phpMyAdmin.

### Primeiro acesso

- **usuário:** `admin`
- **senha:** `admin123`

Faça nesta ordem:

1. **Ajustes → Trocar minha senha** (troque a senha de fábrica agora).
2. **Ajustes → Novo caminhão** — cadastre os 2 caminhões (placa e um apelido, como
   "Scania branca", que ajuda o motorista a reconhecer).
3. **Ajustes → Novo usuário** — crie um acesso para cada motorista, nível
   *Motorista*, com uma senha simples que ele consiga lembrar. Pode usar só o
   apelido dele no nome.

Pronto para usar.

### Usar no celular dos motoristas

Enquanto o site roda no XAMPP do seu computador, o celular precisa estar no
**mesmo wi-fi**:

1. No computador, abra o Prompt de Comando e digite `ipconfig`.
2. Anote o "Endereço IPv4" (algo como `192.168.1.110`).
3. No celular, abra `http://192.168.1.110/frota`.
4. No menu do navegador, toque em **"Adicionar à tela de início"** — o site passa a
   abrir como um aplicativo, em tela cheia.

Se o celular não abrir, o Firewall do Windows está bloqueando: libere o
`httpd.exe` (Apache) para a rede privada.

Para os motoristas lançarem gastos **na estrada**, o site precisa ficar numa
hospedagem na internet — veja "Levar para a internet" no fim deste arquivo.

---

## Como o motorista usa

1. Entra no site (fica logado por 30 dias).
2. Se está começando uma viagem (opcional): **Viagens → Nova viagem** — de onde,
   para onde, caminhão e km do painel. Serve para somar o custo de cada viagem.
3. A cada gasto: **Registrar** → dia, caminhão, viagem, toca no tipo de gasto,
   digita o valor e salva. Pode tirar foto da nota.
   - Em **Abastecimento** aparecem litros e km, e o sistema mostra quanto deu o litro.
   - Em **Outro gasto** ele escreve o que foi (ex.: "chapa para descarga").
4. No fim: **Viagens → Encerrar viagem** (dia da chegada e km final).

Ele pode corrigir ou apagar um gasto que ele mesmo lançou em **Meus gastos**.

## Como o proprietário usa

- **Panorama** — o mês atual: saldo (entradas menos saídas), comparação com o mês
  anterior, gastos por dia, saídas por categoria, entradas por tipo de frete,
  tabela por caminhão, gastos por motorista, total de combustível, litros e preço
  médio do litro.
- **Lançamentos** — tudo que entrou e saiu, com filtros por mês, tipo, motorista,
  caminhão e categoria. Aqui você lança **entradas de frete** e também gastos no
  lugar de um motorista, edita e exclui qualquer lançamento, e baixa a planilha
  (`.csv`, abre no Excel).
- **Relatórios** — histórico de 3, 6, 12 ou 24 meses: gráfico de entradas e saídas
  mês a mês com o saldo de cada mês, tabela mês a mês, desempenho de cada caminhão
  (entradas, saídas, saldo, combustível, litros, R$/litro, km e km/litro) e os
  totais por categoria e por motorista no período.
- **Viagens** — todas as viagens, com gasto, frete e saldo de cada uma.
- **Ajustes** — motoristas e acessos (criar, bloquear, trocar senha, promover a
  proprietário), caminhões e categorias.

### Categorias que já vêm prontas

- **Gastos:** Abastecimento, Salário do motorista, Manutenção, Pneus, Pedágio,
  Seguro, IPVA e licenciamento, Peças e acessórios, Alimentação, Hospedagem,
  Lavagem, Multas e "Outro gasto" (para os gastos eventuais, onde o motorista
  escreve o que foi).
- **Entradas:** Frete de grãos, Frete de calcário, Outro frete e Outra entrada.

Você pode criar quantas outras quiser em **Ajustes → Categorias**, e esconder as
que não usa (sem perder o histórico de quem já foi lançado nelas).

---

## Backup dos dados

São duas coisas:

1. **O banco de dados** — em `http://localhost/phpmyadmin`, selecione o banco
   `frota` e use **Exportar**. Guarde o arquivo `.sql`.
2. **As fotos das notas** — copie a pasta `frota/uploads`.

Faça isso de vez em quando (uma vez por mês, por exemplo).

## Configuração (arquivo `config.php`)

Normalmente não precisa mexer. Se precisar:

| Item | Para que serve |
|---|---|
| `BANCO` | `'mysql'` (padrão) ou `'sqlite'` — veja abaixo. |
| `MYSQL_*` | Dados de acesso do MySQL. No XAMPP é usuário `root` e senha vazia. |
| `ADMIN_*` | Nome, usuário e senha do proprietário criado no primeiro acesso. |
| `NOME_SISTEMA` | O nome que aparece no topo do site e no ícone do celular. |
| `DIAS_LOGADO` | Quantos dias o motorista fica logado sem digitar a senha. |
| `MOSTRAR_ERROS` | Deixe `false`. Só coloque `true` para investigar um problema. |

### Se o MySQL der trabalho

Existe um modo que **não usa o MySQL**: o banco vira um arquivo dentro da pasta
`dados`. Para ligar, mude uma linha no `config.php`:

```php
define('BANCO', conf('BANCO', 'sqlite'));
```

Aí não precisa iniciar o MySQL no XAMPP (só o Apache), e o backup passa a ser
copiar a pasta `dados`. Tudo funciona igual; só não dá para abrir as tabelas no
phpMyAdmin.

---

## Levar para a internet

Para os motoristas usarem de qualquer lugar, coloque os arquivos numa hospedagem
com PHP 8 e MySQL (qualquer hospedagem compartilhada comum serve):

1. Envie a pasta `frota` por FTP para a pasta pública do site.
2. Crie o banco no painel da hospedagem e preencha os dados em `config.php`.
3. Garanta que a pasta `uploads` tenha permissão de escrita (755 ou 775).
4. Use **HTTPS** (quase toda hospedagem oferece certificado grátis). O sistema já
   marca o cookie de sessão como seguro automaticamente quando detecta HTTPS.
5. Troque a senha do `admin` e as senhas dos motoristas.

---

## Para quem for mexer no código

```
index.php              página única que carrega as telas
api.php                porta de entrada da API (api.php?r=rota)
config.php             configuração
manifest.php           dados do "aplicativo" no celular
src/banco.php          conexão e criação das tabelas (MySQL e SQLite)
src/sessao.php         login, sessão e níveis de acesso
src/util.php           validação dos campos (valores, datas, números)
src/rotas.php          todas as rotas da API
assets/estilo.css      aparência (tema claro e escuro, pensado para celular)
assets/app.js          telas, formulários e gráficos
uploads/               fotos das notas (protegida: só sai pela API, com login)
dados/                 banco em arquivo, se usar o modo SQLite
```

Notas de implementação:

- **Valores em centavos** (número inteiro) para não ter erro de arredondamento;
  datas em `AAAA-MM-DD`.
- **Uma tabela `lancamentos`** guarda entradas e saídas; quem define é o campo
  `tipo` da categoria. Assim o saldo é sempre `entradas - saídas`.
- Senhas com `password_hash` (bcrypt), sessão em cookie `HttpOnly`/`SameSite=Lax`,
  freio de 10 tentativas de senha por usuário a cada 10 minutos, e os pedidos que
  gravam exigem o cabeçalho `X-App-Frota` (proteção contra CSRF).
- As consultas SQL são comuns ao MySQL e ao SQLite; só o `CREATE TABLE` muda
  (função `estruturaSql()` em `src/banco.php`).
- Gráficos em HTML e CSS puro, sem bibliotecas externas: o sistema funciona
  mesmo sem internet, dentro da rede da empresa.
