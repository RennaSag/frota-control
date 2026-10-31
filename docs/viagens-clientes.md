# Viagens e clientes — versão 4.0 (histórico)

A versão atual está documentada em [Revisão do PWA — versão 5.0](pwa-revisao.md).

O fluxo principal passa a ser **Viagens**. A navegação reúne Panorama, Viagens,
Clientes e Lançamentos; Notas fiscais e Diárias ficam em Mais no celular.
Perfil e Ajustes são acessados pelo ícone de usuário.

## Uso

- Na nova viagem, escolha um cliente ou cadastre seu nome no mesmo formulário.
  Contatos, CPF/CNPJ, e-mail e observações podem ser completados em Clientes.
- Informe o valor combinado e, se houver, o valor da entrada. Entrada em branco
  ou zero significa que ainda não houve recebimento. A data do recebimento é
  independente da data da viagem.
- A nota pode ser anexada durante o cadastro ou posteriormente pelo botão do
  card. O número da nota também pode ser guardado antes de receber o arquivo.
- Ao encerrar, informe somente o pagamento adicional recebido naquele momento,
  além da entrada já registrada. Marque Valor pago integralmente para receber
  o saldo restante. Um valor em branco mantém o saldo pendente.
- Em viagens encerradas, Serviço quitado abre a confirmação do pagamento do
  saldo. Também é possível desmarcar a opção integral e registrar outra parcela.
- Viagens mostra recebido no mês, pendências do mês, pendências anteriores e
  o total de todos os meses. O filtro de pagamentos pendentes ignora o mês de
  saída para não esconder dívidas antigas. O Panorama continua mostrando o
  total a receber; seu atalho abre as viagens pendentes.
- Clientes permite criar viagens, consultar o histórico com pagamentos e notas,
  editar contatos e arquivar cadastros sem perder o histórico.
- Notas fiscais permanece como uma seção própria, com busca por nome do cliente
  e indicação das datas da viagem. A busca também encontra o nome atual de um
  cliente renomeado.

## Compatibilidade e dados

Os recebimentos continuam sendo lançamentos de entrada. A tabela `recebiveis`
permanece como base financeira, evitando uma segunda contabilidade. Valores
pendentes são derivados dos fretes e recebimentos, nunca baixados sem receita.
Pagamentos acima do saldo e edições abaixo do valor recebido são rejeitados.

A migração 4 adiciona Clientes e seus vínculos, número da nota na viagem e
registros de horário adicionais. Nomes de clientes existentes são importados;
viagens antigas são vinculadas automaticamente quando há um único cliente
identificável nas suas notas e fretes. Associações ambíguas ficam para revisão
manual em Editar viagem. Registros históricos não são apagados.

Cobranças sem viagem e viagens antigas com múltiplos fretes continuam acessíveis
pelo atalho Cobranças anteriores, exibido apenas quando necessário. Quando há
múltiplos fretes, alterações no total são feitas individualmente nesse atalho.

Cadastro, entrada e nota inicial são gravados em uma transação. Encerramento e
pagamento também são atômicos. O recibo de idempotência é confirmado na mesma
transação para evitar duplicação quando a conexão cai. Viagens, notas e
pagamentos suportados continuam utilizando a fila offline existente.

Os horários são apresentados discretamente nos cards, no fuso America/Sao_Paulo.
Horários históricos não disponíveis não são inventados.

## Verificação

```sh
python tests/test_viagens.py --php /caminho/php --extensions /caminho/ext
```

O teste inicia uma cópia temporária do app com SQLite e não usa DATABASE_URL.
Verifica migração e preservação de dados, clientes, entradas, parcelas, quitação,
reenvios, rollback, totais por mês, notas, permissões e paginação. São necessárias
as extensões pdo_sqlite, mbstring e openssl. Não grava dados no banco de produção.
