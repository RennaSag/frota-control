// Tela do ADM (suporte): só lista os acessos e redefine senhas. Ele não vê dados da frota,
// e o proprietário e os motoristas não enxergam o ADM em lugar nenhum.

const ehAdm = () => estado.usuario?.papel === 'sistema';

// Senha fácil de ditar por telefone: sem letras ou números que se confundem (l, 1, O, 0).
function geraSenhaLegivel() {
  const letras = 'abcdefghjkmnpqrstuvwxyz', numeros = '23456789';
  const sorteia = (fonte, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => fonte[v % fonte.length]).join('');
  return `${sorteia(letras, 4)}-${sorteia(numeros, 4)}`;
}

async function telaAdm() {
  document.body.classList.remove('tela-entrada');
  app.innerHTML = `
    <div class="adm-layout">
      <header class="adm-topo">
        <div class="adm-marca">
          <div class="icone-frota">${LOGO}</div>
          <div><strong>${esc(window.NOME_SISTEMA || 'Controle da Frota')}</strong><span>Acesso ADM</span></div>
        </div>
        <button class="btn pequeno" type="button" id="adm-sair">${icone('sair')} Sair</button>
      </header>
      <main class="adm-conteudo pilha">
        <div class="titulo-secao">
          <h1>Senhas e acessos</h1>
          <p>Redefina a senha de quem esqueceu, destrave logins após muitas tentativas e bloqueie ou reative acessos.</p>
        </div>
        <div class="aviso info">${icone('escudo')} As senhas ficam guardadas de forma criptografada, então não dá para ver a senha atual de ninguém, só definir uma nova. Ao trocar a senha, a pessoa é desconectada dos aparelhos.</div>
        <div class="campo adm-busca">
          <label for="adm-busca">Buscar</label>
          <input id="adm-busca" type="search" placeholder="Nome ou usuário" autocomplete="off">
        </div>
        <div class="lista-ajustes-entidades" id="adm-lista"><p class="carregando">Carregando acessos…</p></div>
      </main>
    </div>`;

  let usuarios = [];
  const lista = app.querySelector('#adm-lista');
  const busca = app.querySelector('#adm-busca');

  const desenha = () => {
    const termo = normalizaBusca(busca.value);
    const visiveis = usuarios.filter((u) => !termo || normalizaBusca(`${u.nome} ${u.usuario}`).includes(termo));
    if (!visiveis.length) {
      lista.innerHTML = `<div class="vazio">${usuarios.length ? 'Ninguém encontrado com essa busca.' : 'Nenhum usuário cadastrado.'}</div>`;
      return;
    }
    lista.innerHTML = visiveis.map((u) => {
      const ativo = Number(u.ativo), dono = u.papel === 'admin';
      return `
        <div class="item-ajustes-entidade ${ativo ? '' : 'inativo'}">
          <div style="display:flex;align-items:center;gap:12px;min-width:0">
            <div class="avatar-usuario-ajustes">${iniciais(u.nome)}</div>
            <div class="dados-entidade-ajustes">
              <strong>${esc(u.nome)}</strong>
              <small>@${esc(u.usuario)}${u.telefone ? ` • Tel. ${esc(u.telefone)}` : ''}</small>
              <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                <span class="badge-status ${dono ? 'aberta' : 'encerrada'}">${dono ? 'Proprietário' : 'Motorista'}</span>
                ${ativo ? '<span class="tag-status-visivel">Acesso ativo</span>' : '<span class="tag-status-oculta">Bloqueado</span>'}
                ${u.login_travado ? '<span class="tag-status-oculta">Login travado por tentativas</span>' : ''}
              </div>
            </div>
          </div>
          <div class="acoes-entidade-ajustes">
            ${u.login_travado ? `<button class="btn pequeno" type="button" data-adm-destravar="${u.id}">${icone('cadeado')} Destravar</button>` : ''}
            <button class="btn pequeno principal" type="button" data-adm-senha="${u.id}">${icone('editar')} Nova senha</button>
            <button class="btn pequeno ${ativo ? 'perigo' : ''}" type="button" data-adm-ativo="${u.id}">
              ${ativo ? `${icone('cadeado')} Bloquear` : `${icone('check')} Reativar`}
            </button>
          </div>
        </div>`;
    }).join('');
  };

  const carrega = async () => {
    try {
      usuarios = await api('GET', 'adm-usuarios');
      desenha();
    } catch (erro) {
      lista.innerHTML = `<div class="aviso erro">${esc(erro.message)}</div>`;
    }
  };

  const doId = (id) => usuarios.find((u) => String(u.id) === String(id));

  lista.addEventListener('click', async (e) => {
    const senha = e.target.closest('[data-adm-senha]');
    const ativo = e.target.closest('[data-adm-ativo]');
    const destravar = e.target.closest('[data-adm-destravar]');
    if (senha) return abreNovaSenhaAdm(doId(senha.dataset.admSenha), carrega);
    const alvo = ativo || destravar;
    if (!alvo) return;
    const u = doId(alvo.dataset.admAtivo || alvo.dataset.admDestravar);
    let corpo;
    if (destravar) corpo = { destravar: true };
    else {
      const bloquear = Number(u.ativo) === 1;
      if (bloquear && !confirm(`Bloquear o acesso de ${u.nome}? A pessoa sai de todos os aparelhos e não consegue entrar até ser reativada.`)) return;
      corpo = { ativo: !bloquear };
    }
    alvo.disabled = true;
    try {
      await api('PUT', 'adm-usuario', { id: u.id }, corpo);
      recado(destravar ? `Login de ${u.nome} destravado.` : corpo.ativo ? `Acesso de ${u.nome} reativado.` : `Acesso de ${u.nome} bloqueado.`);
      await carrega();
    } catch (erro) {
      alvo.disabled = false;
      recado(erro.message);
    }
  });
  busca.addEventListener('input', desenha);
  app.querySelector('#adm-sair').onclick = async () => {
    if (!confirm('Sair do acesso ADM?')) return;
    await saiDaConta();
  };
  await carrega();
}

function abreNovaSenhaAdm(u, depois) {
  if (!u) return;
  const { elemento, fechar } = janela(`Nova senha · ${u.nome}`, `
    <form class="form-pilha" novalidate>
      <p class="ajuda" style="margin:0">Defina a nova senha de <strong>@${esc(u.usuario)}</strong> e passe para a pessoa. Ela pode trocar depois em Perfil.</p>
      <div class="campo">
        <label for="adm-nova">Nova senha</label>
        ${campoSenha('adm-nova', 'senha_nova', 'required minlength="4" autocomplete="new-password"')}
      </div>
      <button class="btn pequeno" type="button" data-gerar>${icone('cadeado')} Gerar senha fácil de ditar</button>
      <div class="acoes fim">
        <button class="btn" type="button" data-cancelar>Cancelar</button>
        <button class="btn principal" type="submit">${icone('check')} Salvar nova senha</button>
      </div>
    </form>`);
  const form = elemento.querySelector('form');
  const campo = form.elements.senha_nova;
  form.querySelector('[data-cancelar]').onclick = fechar;
  form.querySelector('[data-gerar]').onclick = () => {
    campo.value = geraSenhaLegivel();
    campo.type = 'text';
    campo.focus();
    campo.select();
  };
  aoEnviar(form, async (dados) => {
    if ((dados.senha_nova || '').length < 4) throw new Error('A senha deve ter ao menos 4 caracteres.');
    await api('PUT', 'adm-usuario', { id: u.id }, { senha_nova: dados.senha_nova });
    fechar();
    const { elemento: ok, fechar: fecharOk } = janela('Senha atualizada', `
      <div class="pilha">
        <p style="margin:0">Passe a nova senha para <strong>${esc(u.nome)}</strong>:</p>
        <p class="adm-senha-nova"><span>@${esc(u.usuario)}</span><code>${esc(dados.senha_nova)}</code></p>
        <p class="ajuda" style="margin:0">A pessoa foi desconectada dos aparelhos e entra de novo com essa senha.</p>
        <div class="acoes fim">
          <button class="btn" type="button" data-copiar>Copiar senha</button>
          <button class="btn principal" type="button" data-ok>Pronto</button>
        </div>
      </div>`);
    ok.querySelector('[data-ok]').onclick = fecharOk;
    ok.querySelector('[data-copiar]').onclick = async () => {
      try { await navigator.clipboard.writeText(dados.senha_nova); recado('Senha copiada.'); } catch { recado('Não foi possível copiar. Anote a senha.'); }
    };
    depois();
  });
}
