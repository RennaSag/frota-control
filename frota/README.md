# Controle da Frota

Sistema web para controlar o dinheiro que entra (fretes) e o que sai (gastos) de uma
empresa de caminhões. Funciona no computador e no celular (Android e iPhone), pelo
navegador — não precisa instalar aplicativo.

## Os dois níveis de acesso

| | **Motorista** | **Proprietário** |
|---|---|---|
| Lançar gastos e abrir viagens | sim | sim |
| Lançar entradas (fretes) | **não** | sim |
| Ver lançamentos | só os próprios gastos | todos |
| Editar / excluir gasto ou viagem | só o que ele registrou, **nos primeiros 5 minutos** | **tudo, a qualquer hora** |
| Encerrar a própria viagem | sim | sim |
| Enviar notas fiscais (foto ou PDF) | sim | sim |
| Registrar dias trabalhados (diárias) | os próprios | de qualquer motorista |
| Pagar diárias | não | sim |
| Receita da empresa (fretes recebidos) | **só consulta** | consulta e altera (em Lançamentos) |
| Fretes a receber (o que os clientes devem) | não | sim |
| Panorama | não | sim |
| Cadastros (motoristas, caminhões, categorias) | não | sim |

O motorista entra e cai na lista dos gastos dele. Ele não vê os lançamentos dos outros
motoristas, nem os gastos da empresa; da parte financeira, vê só a receita (fretes
recebidos e o total a receber), sem poder mudar nada.

### Prazo de 5 minutos do motorista

Quando o motorista registra um gasto, uma viagem, uma nota fiscal ou uma diária, ele tem
**5 minutos** para corrigir ou apagar. A tela mostra quanto tempo falta. Depois disso os
botões somem e o servidor recusa a alteração: só o proprietário pode mudar. Encerrar a
viagem (dia e km de chegada) continua liberado para o motorista.

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

> Pelo endereço `http://192.168...` o app abre, mas **não funciona sem internet nem
> recebe notificações**: o navegador só libera isso em sites com **https**. Na
> hospedagem (com https) tudo funciona.

Para os motoristas lançarem gastos **na estrada**, o site precisa ficar numa
hospedagem na internet — veja "Levar para a internet" no fim deste arquivo.

---

## Aplicativo no celular, sem internet e notificações

Com o site em **https**, ele vira um aplicativo de verdade (PWA):

- **Instalar** — Android/computador: **Perfil/Ajustes → Instalar agora** (ou o menu do
  Chrome → *Instalar app*). iPhone: abra no **Safari** → **Compartilhar** →
  **Adicionar à Tela de Início**, e use sempre pelo ícone.
- **Sem internet** — o app abre mesmo sem sinal, mostrando os últimos dados vistos (uma
  faixa amarela avisa). Gastos, viagens novas, encerrar viagem, notas fiscais (com a foto)
  e dias trabalhados ficam **guardados no aparelho**; um relógio amarelo no topo mostra
  quantos. Quando o sinal volta eles são enviados sozinhos, na ordem (um gasto lançado numa
  viagem aberta sem sinal vai ligado a ela). No Android o envio acontece até com o app
  fechado. Editar e excluir precisam de internet. Se o servidor recusar algum registro, ele
  fica marcado em vermelho no relógio para corrigir ou descartar.
- **Notificações** — **Perfil/Ajustes → Ativar notificações** em cada aparelho. O
  proprietário recebe o que os motoristas registram; o motorista recebe viagem aberta para
  ele e diárias pagas. Chegam com o app fechado (Android, computador e iPhone com iOS 16.4
  ou mais novo, **com o app instalado na tela de início**). O número de avisos aparece
  também no ícone do app.
- **Atalhos** — segurando o ícone (Android): Registrar gasto, Nova viagem, Nota, Diária.
- **Compartilhar** — no Android, uma foto ou PDF de outro app (galeria, WhatsApp) pode ser
  compartilhada direto para o app, como nota fiscal ou comprovante de gasto.
- **Sair da conta** apaga do aparelho os dados guardados e desliga as notificações daquela
  conta (precisa de internet; se houver algo ainda não enviado, o app avisa antes).

## Como o motorista usa

1. Entra no site (fica logado por 30 dias).
2. Se está começando uma viagem (opcional): **Viagens → Nova viagem** — de onde,
   para onde, caminhão e km do painel. Serve para somar o custo de cada viagem.
   Também dá para abrir a viagem na hora de lançar: no campo **Viagem**, toque em
   **+ Registrar nova viagem**; ela é criada e já fica escolhida no lançamento.
3. A cada gasto: **Registrar** → dia, caminhão, viagem, toca no tipo de gasto,
   digita o valor e salva. Pode tirar foto da nota.
   - Em **Abastecimento** aparecem litros e km, e o sistema mostra quanto deu o litro.
   - Em **Outro gasto** ele escreve o que foi (ex.: "chapa para descarga").
4. No fim: **Viagens → Encerrar viagem** (dia da chegada e km final).

Ele pode corrigir ou apagar um gasto que ele mesmo lançou em **Meus gastos**, nos
primeiros 5 minutos.

Também no app do motorista:

- **Notas fiscais** — toca em **Enviar nota fiscal**, tira a foto da nota (ou escolhe o
  PDF) e, se quiser, preenche número, cliente, valor e viagem. O escritório recebe um aviso.
- **Diárias** — **Registrar dia trabalhado** (ou vários dias seguidos de uma vez). Ele vê
  quantos dias trabalhou no mês, o valor da diária, o total e quanto ainda tem a receber.
- **Receita** (no botão **Mais**, no celular) — quanto a empresa recebeu de fretes no
  período, por tipo de frete e por caminhão, e o total que os clientes ainda devem.
  Só consulta.

## Como o proprietário usa

- **Panorama** — abre sempre no mês atual; dá para escolher outro mês ou um período
  de vários meses (de/até, ou atalhos como "Últimos 3 meses" e "Este ano"). Mostra
  o saldo (entradas menos saídas) comparado ao período anterior, gastos por dia
  (um mês) ou gráfico e tabela mês a mês (vários meses), desempenho de cada
  caminhão (entradas, saídas, saldo, combustível, litros, R$/litro, km e km/litro),
  saídas por categoria, entradas por tipo de frete e gastos por motorista. O botão
  **Baixar PDF do panorama** gera tudo isso em PDF, junto com a lista de
  lançamentos do período.
- **Lançamentos** — tudo que entrou e saiu, com filtros por mês, tipo, motorista,
  caminhão e categoria. Aqui você lança **entradas de frete** e também gastos no
  lugar de um motorista, edita e exclui qualquer lançamento, e baixa o relatório
  em PDF.
- **Avisos (sino no topo)** — tudo que os motoristas registram, editam ou excluem,
  e as viagens que eles abrem. O número vermelho mostra quantos avisos são novos.
  Com o app aberto, ele confere a cada minuto e mostra um recado quando chega
  algo novo. Tocando em "Ativar notificações", o aviso aparece também na tela do
  aparelho (enquanto o app estiver aberto ou em segundo plano no navegador).
- **A receber** — os fretes combinados com os clientes e quanto falta de cada um.
  Mostra o **recebido no mês**, o **total a receber**, o que está **vencido** e a
  situação de cada frete: *a receber*, *recebido em parte* ou *recebido*. Em
  **Registrar pagamento** você lança o que o cliente pagou (tudo ou uma parte); isso vira
  uma entrada em Lançamentos, ligada ao frete. Ao lançar uma entrada pelo botão normal,
  dá para escolher a qual frete ela pertence.
- **Viagens** — todas as viagens, com gasto, frete e saldo de cada uma. No detalhe da
  viagem, **Lançar diárias** cria uma diária para o motorista em cada dia da viagem.
- **Diárias** — dias trabalhados de cada motorista no mês, total, pago e a pagar. O botão
  **Pagar** quita de uma vez as diárias pendentes do mês: vira um gasto em Lançamentos
  (categoria "Diárias de motorista"). Se esse lançamento for excluído, as diárias voltam
  a ficar pendentes. O valor da diária de cada motorista fica em **Ajustes → Editar**.
- **Notas fiscais** — as notas enviadas por você e pelos motoristas, com a foto ou o PDF.
  De uma nota dá para **Criar frete a receber** já preenchido.
- **Ajustes** — motoristas e acessos (criar, bloquear, trocar senha, promover a
  proprietário, valor da diária, caminhão padrão), caminhões e categorias. Motorista ou
  caminhão sem nenhum histórico pode ser excluído; com histórico, bloqueie ou marque
  como fora de operação.

### Categorias que já vêm prontas

- **Gastos:** Abastecimento, Salário do motorista, Diárias de motorista, Manutenção,
  Pneus, Pedágio, Seguro, IPVA e licenciamento, Peças e acessórios, Alimentação,
  Hospedagem, Lavagem, Multas e "Outro gasto" (para os gastos eventuais, onde o
  motorista escreve o que foi). Salário e Diárias ficam escondidas dos motoristas
  (opção "Esconder dos motoristas" na categoria).
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
manifest.php           dados do "aplicativo" no celular (ícones, atalhos, compartilhar)
sw.js                  service worker: abre sem internet, envia a fila, mostra os pushes
src/banco.php          conexão e criação das tabelas (MySQL e SQLite)
src/sessao.php         login, sessão e níveis de acesso
src/util.php           validação dos campos (valores, datas, números)
src/push.php           notificações push (Web Push/VAPID, sem bibliotecas)
src/fila.php           envios repetidos da fila do aparelho não gravam duas vezes
src/rotas.php          todas as rotas da API
assets/estilo.css      aparência (tema claro e escuro, pensado para celular)
assets/app.js          telas, formulários e gráficos
assets/fila.js         fila de envios feitos sem internet (IndexedDB), usada também pelo sw.js
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
- As consultas SQL são comuns ao MySQL, ao SQLite e ao PostgreSQL; só o `CREATE TABLE`
  muda (função `estruturaSql()` em `src/banco.php`).
- **Atualização do banco:** a tabela `esquema` guarda a versão da estrutura
  (`VERSAO_ESQUEMA`). Quando ela sobe, a primeira visita cria as tabelas novas e
  acrescenta as colunas novas nas tabelas antigas, sem apagar dados.
- **Fretes a receber:** o que falta receber nunca é gravado; é sempre o valor do frete
  menos a soma das entradas com aquele `recebivel_id`. Assim não há como desencontrar.
- **Prazo do motorista:** `MINUTOS_PARA_CORRIGIR` em `src/rotas.php` (o servidor decide;
  a tela só mostra o tempo que falta).
- **Sem internet:** o `sw.js` guarda a casca do app e a última resposta de cada consulta
  da API (cache `frota-dados`, apagado ao sair ou entrar com outra conta). O que é gravado
  sem sinal vai para o IndexedDB (`assets/fila.js`); fotos e viagens criadas offline usam
  ids `local:...`, trocados pelos verdadeiros na hora do envio. Cada envio leva o cabeçalho
  `X-Fila-Id` e o servidor guarda a resposta em `envios_fila`, então um reenvio devolve a
  mesma resposta em vez de gravar de novo.
- **Versão do app:** `$v` em `index.php`. Ao subir o número, os aparelhos baixam a nova
  versão e refazem o cache (o `sw.js` é registrado como `sw.js?v=...`).
- **Push:** as chaves VAPID são criadas sozinhas na primeira vez (tabela `configuracoes`).
  O contato enviado ao Google/Apple fica em `PUSH_CONTATO` (`config.php` ou variável
  `FROTA_PUSH_CONTATO`). Precisa do OpenSSL no PHP (já vem no XAMPP e na imagem Docker).
  Os pushes saem depois que a resposta foi entregue, para ninguém esperar por eles.
- Gráficos em HTML e CSS puro, sem bibliotecas externas: o sistema funciona
  mesmo sem internet, dentro da rede da empresa.
