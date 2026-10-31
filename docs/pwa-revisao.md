# Revisão do PWA — versão 7.0

## Ajustes da versão 7

- Busca por várias palavras, em qualquer ordem, sem depender de acentos. Clientes
  incluem contatos, documentos e endereço; lançamentos incluem categoria,
  motorista, caminhão, cliente e locais da viagem. Sugestões facilitam a digitação.
- Os filtros de lançamentos e os registros ainda na fila usam as mesmas condições
  de tipo, categoria, motorista, caminhão e período. Respostas antigas não
  substituem uma consulta mais recente. Edição e exclusão individuais foram conferidas.
- Nova viagem tem três etapas: cliente e rota; operação; valores e nota. Voltar
  preserva os dados preenchidos e a validação leva ao campo que precisa de correção.
- Cartões de viagem separam cliente, situação, rota, equipe, saldo e ações. A data
  da viagem aparece no rodapé direito, sem data/hora de cadastro. O saldo pendente
  fica amarelo. Ações de gasto têm cor própria; diárias são geridas na aba específica.
- Clientes não usam abreviações como avatar. O próprio cartão abre o histórico,
  que organiza os contatos, endereço e a ação de nova viagem.
- Diárias têm busca por motorista e um único botão de filtros. Pendências usam
  amarelo; pagamentos usam verde. A categoria pergunta “Visível aos motoristas?”
  com opções Sim/Não, mantendo a mesma regra de autorização no servidor.
- Pagar offline atualiza a lista e o saldo no aparelho e impede selecionar
  novamente os mesmos dias. A consulta de um motorista reutiliza a lista salva;
  o reenvio confirma o pagamento uma única vez e preserva dependências de cadastros.
- A conferência no navegador interrompeu a conexão da prévia, registrou uma diária
  isolada offline e sincronizou após restabelecer o servidor. Houve uma única
  gravação no banco. Os registros temporários da conferência foram removidos.
- A API de Workers passou pelos testes com PostgreSQL descartável em memória e
  pelo build do Wrangler em modo dry-run. Nenhuma publicação foi realizada.

## Ajustes da versão 6

- O perfil do motorista é acessado pela navegação inferior. O caminhão padrão
  pode ser escolhido no próprio perfil, inclusive sem conexão, e continua
  podendo ser trocado nos novos registros.
- Receita apresenta o panorama da empresa somente para consulta, nos meses
  atual e anterior. O servidor também recusa outros meses, intervalos e
  relatórios para motoristas; a consulta do mês anterior não revela comparações
  com meses mais antigos.
- Notas fiscais têm apenas arquivo e número nos formulários. Ao editar, os
  demais dados originais continuam preservados. Viagens reúnem período e
  situação no botão de filtro à direita da busca.
- Sessão guardada, fila e dados offline são separados por banco/ambiente.
  A atualização identifica os dados legados antes de trocar a demonstração
  pelo banco real, impedindo envio de cadastros de teste ao banco conectado.
- Conferência visual em largura de celular: Receita, Panorama, perfil,
  nova viagem e nota, sem rolagem horizontal. Testes da API e da fila incluem
  preferência de caminhão, acesso aos meses permitidos, preservação das notas
  e isolamento entre ambientes.

## Fluxos atualizados

- Navegação do proprietário: Panorama, Lançamentos, Viagens e Clientes, seguidos
  por Diárias. Notas são consultadas nas viagens e no histórico do cliente.
- Viagens mostra um resumo compacto do saldo pendente. O cadastro seleciona o
  cliente mais recente, oferece os dez últimos e uma pesquisa dos demais.
  Origem e destino aceitam locais livres; responsável e km ficam visíveis.
- Os formulários de cliente incluem endereço opcional: CEP, logradouro, número,
  complemento, bairro, cidade e UF.
- Janelas secundárias preservam as anteriores, incluindo conteúdo preenchido e
  posição de rolagem. Fechar uma nota ou lançamento retorna ao detalhe anterior.
- No celular, os gráficos se ajustam à largura e a tabela de caminhões vira
  cartões com rótulos. Não há dependência de rolagem horizontal.

## Diárias

A visualização inicial reúne pendências de todos os meses, inclusive de
motoristas desativados. O proprietário pode filtrar por motorista, consultar
os registros do mês ou o histórico de pagamentos. Cada pagamento mostra data,
motorista, quantidade de dias e valor, com acesso ao lançamento correspondente.

O registro em lote aceita intervalo e dias da semana, mostra uma estimativa e
ignora dias já registrados. O pagamento pode abranger todas as pendências de um
motorista ou somente as diárias selecionadas, inclusive de meses diferentes.
As seleções são conferidas novamente pelo servidor dentro de uma transação.

O administrador pode corrigir ou excluir diárias já pagas. O lançamento ligado
é recalculado; se nenhuma diária restar, o pagamento é removido. Excluir um
pagamento por Lançamentos continua reabrindo suas diárias.

## Permissões

Motoristas só corrigem ou excluem registros que eles mesmos criaram e durante
os primeiros 120 segundos. O servidor aplica a regra, além dos botões da tela.
Viagens guardam o autor separado do motorista responsável. Administradores não
têm essa limitação de prazo. Encerrar uma viagem é uma operação de trabalho,
que pode acontecer depois; não é uma edição retroativa do cadastro.

Cadastros feitos offline preservam o horário original ao sincronizar. O envio
nunca estende o prazo com um horário futuro. Uma correção que já esteja fora do
prazo exige o proprietário; editar e excluir registros existentes requer rede.

## O que funciona offline

Após o primeiro acesso online e a preparação dos dados no aparelho:

- Reabrir o app com a sessão e os dados locais do usuário anterior ainda válidos.
- Cadastrar clientes, caminhões, categorias, viagens, gastos, entradas, notas e
  diárias, de acordo com as permissões da conta.
- Anexar fotos/PDFs aos cadastros, guardando os arquivos no IndexedDB.
- Vincular registros ainda locais: cliente → viagem → nota/gasto e
  diárias → pagamento. Os identificadores temporários são trocados no envio.
- Registrar encerramentos e recebimentos de viagens e pagamentos de diárias.
- Ver os cadastros locais identificados como guardados no aparelho e consultar
  a fila de pendências e os erros que precisam de revisão.

Os totais financeiros guardados são a última posição confirmada no servidor.
O aviso de falta de conexão identifica essa condição. Operações na fila não
são pagamentos bancários: são registros administrativos a sincronizar.

Primeiro login, criação de acessos/senhas, alterações de permissão, edições e
exclusões de registros já enviados exigem conexão. PDFs de relatórios e arquivos
antigos não previamente disponíveis no aparelho dependem da rede. Os dados
precisam de armazenamento disponível; limpar os dados do navegador/aplicativo
remove os registros locais que ainda não tenham sido enviados.

## Sincronização e proteção dos dados

- Tenta enviar ao voltar a conexão, ao abrir/retomar o app e periodicamente
  enquanto ele estiver visível. Usa Background Sync onde houver suporte.
- Clientes, caminhões e categorias passaram a integrar a fila. Os identificadores
  de cada dia criado em lote também são mapeados para pagamentos posteriores.
- Envios têm prazo de espera e são retomados após falha de rede ou resposta
  incompleta. Uma rejeição de validação permanece visível para revisão.
- Alterações compostas e o recibo de idempotência são confirmados juntos no banco.
  Uma resposta perdida não gera uma segunda entrada ou um segundo pagamento.
- Dados offline são separados por conta; a saída limpa a sessão e os caches
  correspondentes. Avisos push não são enviados quando a gravação foi rejeitada.
- A instalação do service worker só termina depois de guardar a casca e os ícones
  do app. Falhas nessa etapa não substituem uma versão anterior funcionando.

## iPhone, Android e computador

O site publicado deve usar HTTPS. O acesso local funciona em localhost. O primeiro
acesso e a instalação devem ser feitos com rede para preparar os arquivos e os
dados necessários.

A API de Background Sync tem suporte limitado. No iPhone, a estratégia segura
é enviar ao abrir ou trazer o app para o primeiro plano com conexão. Não se deve
prometer envio imediato com o app fechado em todas as plataformas. Referência:
[Background Synchronization API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).

As alterações foram verificadas em navegador com largura de celular e por
testes locais automatizados. Isso não substitui homologação em um iPhone e um
Android reais, incluindo câmera, instalação, troca de rede, suspensão do app,
armazenamento e reautenticação. Push requer homologação separada com HTTPS e
permissão de notificações.

## Verificações executadas

```sh
python tests/test_viagens.py --php /caminho/php --extensions /caminho/ext
node tests/test_offline.mjs
```

Os testes da API usam uma cópia temporária do app com SQLite. Verificam endereço,
pagamentos, migração, prazo do motorista, autoria, diárias em lote, seleções,
histórico, correção de diárias pagas, isolamento e idempotência.

O teste da fila usa o código real com armazenamento e transporte simulados para
perder uma resposta após a gravação e conferir o reenvio e todas as dependências.
Também foi feito um teste no navegador com o servidor da demonstração desligado:
reabertura, cadastro de cliente/endereço e viagem/entrada, persistência após
recarregar e envio único ao reativar o servidor. Nenhum teste usou o Neon.


## Interface 7.0.1

Detalhes de viagem organizados em rota, operação, resumo financeiro, documentos e lançamentos. Cartões de clientes com contato, localização, situação e ações. Perfil superior disponível somente no celular para administradores; acesso lateral identificado como Perfil e ajustes. Layouts conferidos no desktop e na largura de 390 px, sem rolagem horizontal. Cancelar um gasto retorna aos detalhes da viagem. Versão dos arquivos atualizada para renovar o cache do PWA.


## Interface 7.0.2

Ajustes separados em Motoristas, Caminhões, Categorias e Minha conta, com cadastros e ações alinhados. Formulários de entrada e gasto divididos em valor/categoria, operação e complementos; busca de categorias sem acentos. Troca do tipo mantém os campos comuns e o comprovante anexado. Cartões de viagens abertas têm atalho de encerramento; detalhes usam Adicionar em lilás e valores vermelhos/ verdes conforme o tipo. Conferência visual e navegação em 390 px e desktop, sem salvar lançamentos na base de demonstração.


## Interface 7.0.3

Gasto e entrada com formulário compacto: valor, categoria em lista, data, caminhão e viagem. Responsável preenchido automaticamente, sem seletor de autoria. Detalhes, cobranças anteriores e comprovantes ficam recolhidos, abrindo automaticamente em edições com dados existentes. Campos de abastecimento e descrição continuam condicionais. Conferidos troca de tipo, seleção de categoria, layout móvel sem rolagem horizontal e testes de fila offline.


## Interface e filtros 7.1

Categorias com ícones, modelos, descrição e controle de abastecimento; ordem persistida atomicamente por tipo, com arraste, alça de toque e teclado. Categorias com histórico preservam o controle de abastecimento. Clientes com mailto e WhatsApp, sem envio automático. Cartões de viagem abrem a lista de notas existentes e permitem anexar novas, preservando a navegação. Panorama com filtros por responsável, caminhão e categoria aplicados a todas as séries financeiras, comparação anterior e PDF. Pendente geral da frota identificado; quilômetros correspondem às viagens filtradas por motorista/caminhão. Gráficos com escalas, legenda, valores consultáveis e agrupamento semanal no celular.
