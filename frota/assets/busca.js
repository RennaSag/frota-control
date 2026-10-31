// Mesmas palavras, em qualquer ordem; acentos e formatação não atrapalham a busca.
function normalizaBusca(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
}
function combinaBusca(consulta, valores) {
  const campos=(Array.isArray(valores)?valores:[valores]).filter((v)=>v!=null).map(String);
  const texto=normalizaBusca(campos.join(' '));
  const numeros=campos.map((v)=>v.replace(/\D/g,'')).join(' ');
  return normalizaBusca(consulta).split(/\s+/).filter(Boolean).every((palavra)=>texto.includes(palavra) || /^\d+$/.test(palavra) && numeros.includes(palavra));
}
function palavrasCliente(c) {
  return [c.nome,c.telefone,c.documento,c.email,c.observacao,c.logradouro,c.bairro,c.cidade,c.uf,c.cep];
}
function localViagem(texto) {
  return String(texto ?? '').replace(/\s+(?:[—–]|--+)\s+/g,', ').replace(/^(?:--+|[—–])\s+/,'');
}
function sugestoesBusca(id, valores) {
  return `<datalist id="${id}">${[...new Set(valores.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR')).slice(0,300).map((v)=>`<option value="${esc(v)}"></option>`).join('')}</datalist>`;
}
