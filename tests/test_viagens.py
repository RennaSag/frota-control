"""Regressão da API em uma cópia temporária do app e banco SQLite descartável.

python tests/test_viagens.py --php /caminho/php --extensions /caminho/ext
"""
import argparse
import http.cookiejar
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--php', default='php')
    parser.add_argument('--extensions')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory(prefix='frota-tests-') as temp:
        base = Path(temp)
        shutil.copytree(root / 'frota', base / 'app', ignore=shutil.ignore_patterns('*.sqlite*', 'uploads'))
        (base / 'app' / 'uploads').mkdir()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        command = [args.php]
        if args.extensions:
            command += ['-d', f'extension_dir={args.extensions}']
        command += ['-d', 'extension=pdo_sqlite', '-d', 'extension=mbstring', '-d', 'extension=openssl', '-d', 'date.timezone=America/Sao_Paulo', '-S', f'127.0.0.1:{port}', '-t', str(base / 'app')]
        env = dict(os.environ, DATABASE_URL='', FROTA_BANCO='sqlite', FROTA_SQLITE_ARQUIVO=str(base / 'test.sqlite'))
        env['FROTA_ADMIN_SENHA'] = 'admin123'
        with (base / 'server.log').open('w') as log:
            server = subprocess.Popen(command, env=env, stdout=log, stderr=log, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            try:
                url = f'http://127.0.0.1:{port}/api.php?'
                admin = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

                def api(method, route, body=None, params=None, status=200, client=admin, key=None, registered=None):
                    headers = {'X-App-Frota': '1', 'Content-Type': 'application/json'}
                    if key: headers['X-Fila-Id'] = key
                    if registered: headers['X-Registrado-Em'] = str(registered)
                    req = urllib.request.Request(url + urllib.parse.urlencode(dict(r=route, **(params or {}))),
                        data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
                    try:
                        response = client.open(req, timeout=15)
                    except urllib.error.HTTPError as e:
                        response = e
                    data = json.loads(response.read())
                    assert response.code == status, (method, route, response.code, data)
                    return data

                for _ in range(50):
                    try:
                        api('POST', 'login', {'usuario': 'admin', 'senha': 'admin123'})
                        break
                    except urllib.error.URLError:
                        time.sleep(.1)
                else:
                    raise AssertionError('Servidor de teste não iniciou')

                client = api('POST', 'clientes', {'nome': 'Cliente Teste', 'email': 'teste@example.com', 'logradouro':'Rua Teste', 'numero':'42', 'cidade':'Santos','uf':'SP','cep':'11000-000'})
                assert client['logradouro']=='Rua Teste' and client['numero']=='42' and client['uf']=='SP'
                api('POST', 'clientes', {'nome': 'cliente teste'}, status=400)
                api('POST', 'clientes', {'nome': 'Email inválido', 'email': 'invalido'}, status=400)
                def trip(**values):
                    return dict(origem='Origem', destino='Destino', inicio='2026-10-10', cliente_id=client['id'], valor_viagem='1.000,00', **values)
                a = api('POST', 'viagens', trip(valor_entrada='200,00', data_pagamento='2026-10-10'), key='trip-create-0001')['id']
                assert api('POST', 'viagens', trip(valor_entrada='200,00'), key='trip-create-0001')['id'] == a
                def get_trip(id): return api('GET', 'viagens', params={'id': id})[0]
                v = get_trip(a)
                assert (v['valor_frete_centavos'], v['recebido_centavos']) == (100000, 20000), v
                assert len(api('GET', 'viagens', params={'cliente_id': client['id']})) == 1
                api('POST', 'viagem-encerrar', {'fim': '2026-10-11', 'valor_pago': '300,00', 'data_pagamento': '2026-10-11'}, {'id': a}, key='trip-close-0001')
                api('POST', 'viagem-encerrar', {'fim': '2026-10-11', 'valor_pago': '300,00'}, {'id': a}, key='trip-close-0001')
                v = get_trip(a)
                assert v['status'] == 'encerrada' and v['recebido_centavos'] == 50000, v
                summary = api('GET', 'viagens-financeiro', params={'mes': '2026-10'})
                assert summary['recebido_mes_centavos'] == 50000 and summary['pendente_mes_centavos'] == 50000, summary
                api('POST', 'viagem-pagamento', {'valor_pago': '500,01'}, {'id': a}, status=400)
                api('POST', 'viagem-pagamento', {'valor_pago': '100,00', 'data_pagamento': '2026-10-12'}, {'id': a}, key='trip-payment-0001')
                api('POST', 'viagem-pagamento', {'valor_pago': '100,00', 'data_pagamento': '2026-10-12'}, {'id': a}, key='trip-payment-0001')
                assert get_trip(a)['recebido_centavos'] == 60000
                api('POST', 'viagem-pagamento', {'integral': '1', 'data_pagamento': '2026-10-13'}, {'id': a})
                api('POST', 'viagem-pagamento', {'integral': '1', 'data_pagamento': '2026-10-13'}, {'id': a})
                assert get_trip(a)['recebido_centavos'] == 100000
                api('POST', 'viagem-encerrar', {'fim': '2026-10-11'}, {'id': a})
                # A falha no pagamento desfaz também a nova viagem e o novo cliente.
                invalid = trip(valor_entrada='1000,01', cliente_novo='Não deve existir')
                api('POST', 'viagens', invalid, status=400)
                assert not any(c['nome'] == 'Não deve existir' for c in api('GET', 'clientes'))
                b = api('POST', 'viagens', trip(valor_entrada='0'))['id']
                api('POST', 'viagem-encerrar', {'fim': '2026-10-11', 'valor_pago': ''}, {'id': b})
                assert get_trip(b)['recebido_centavos'] == 0
                c = api('POST', 'viagens', trip())['id']
                api('POST', 'viagem-encerrar', {'fim': '2026-10-09', 'integral': '1'}, {'id': c}, status=400)
                assert get_trip(c)['status'] == 'aberta'
                api('POST', 'viagem-encerrar', {'fim': '2026-10-11', 'integral': '1', 'data_pagamento': '2026-10-11'}, {'id': c})
                assert get_trip(c)['recebido_centavos'] == 100000
                earlier = trip(); earlier['inicio'] = '2026-09-10'
                api('POST', 'viagens', earlier)
                summary = api('GET', 'viagens-financeiro', params={'mes': '2026-10'})
                assert summary['pendente_anterior_centavos'] == 100000 and summary['pendente_mes_centavos'] == 100000, summary
                assert summary['a_receber_centavos'] == 200000
                # Nota inicial faz parte da mesma operação e retorna as datas da viagem.
                (base / 'app' / 'uploads' / 'teste.pdf').write_bytes(b'%PDF-1.4\n%%EOF')
                d = api('POST', 'viagens', trip(nota_arquivo='teste.pdf', nota_numero='123', nota_data='2026-10-09'))['id']
                notes = api('GET', 'notas', params={'busca': 'Cliente Teste', 'viagem_id': d})
                assert len(notes) == 1 and notes[0]['viagem_inicio'] == '2026-10-10' and notes[0]['numero'] == '123', notes
                # Edição abaixo do já recebido é rejeitada sem alterar origem nem valor.
                edit = trip(); edit.update(origem='Não salvar', valor_viagem='100', status='encerrada', fim='2026-10-11')
                api('PUT', 'viagem', edit, {'id': a}, status=400)
                assert get_trip(a)['origem'] == 'Origem'
                # Motoristas só acessam as próprias viagens e não quitam saldos de terceiros.
                driver = api('POST', 'usuarios', {'nome':'Motorista Teste', 'usuario':'motorista', 'senha':'teste123'})['id']
                driver_client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
                api('POST', 'login', {'usuario':'motorista', 'senha':'teste123'}, client=driver_client)
                truck=api('POST','caminhoes',{'placa':'ABC1D23','apelido':'Padrão de teste'})['id']
                # Busca combina categoria, motorista e placa, sem exigir acentos ou ordem.
                fuel=next(c for c in api('GET','categorias') if c['nome']=='Abastecimento')['id']
                expense={'categoria_id':fuel,'usuario_id':driver,'caminhao_id':truck,'descricao':'Diesel S10 São João','valor':'310','litros':'50','data':'2026-10-20'}
                one=api('POST','lancamentos',expense)['id']
                found=api('GET','lancamentos',params={'mes':'2026-10','busca':'motorista diesel abc1 padrao','tipo':'saida','categoria_id':fuel,'caminhao_id':truck,'usuario_id':driver})
                assert found['qtd']==1 and found['itens'][0]['id']==one,found
                assert api('GET','lancamentos',params={'busca':'motorista diesel abc1','tipo':'entrada'})['qtd']==0
                api('PUT','lancamento',{**expense,'valor':'300'},params={'id':one})
                assert api('GET','lancamento',params={'id':one})['valor_centavos']==30000
                api('DELETE','lancamento',params={'id':one})
                api('GET','lancamento',params={'id':one},status=404)
                pref=api('POST','meu-caminhao',{'caminhao_padrao_id':truck,'usuario_id':1},client=driver_client)
                assert pref['id']==driver and pref['caminhao_padrao_id']==truck
                assert api('GET','eu',client=driver_client)['caminhao_padrao_id']==truck
                assert next(u for u in api('GET','usuarios') if u['id']==1)['caminhao_padrao_id'] is None
                api('POST','meu-caminhao',{'caminhao_padrao_id':999999},client=driver_client,status=400)
                revenue=api('GET','receita',client=driver_client)
                assert 'atual' in revenue and 'por_motorista' not in revenue and 'itens' not in revenue
                import datetime
                current=revenue['de']
                previous=(datetime.date.fromisoformat(current+'-01')-datetime.timedelta(days=1)).strftime('%Y-%m')
                old=(datetime.date.fromisoformat(previous+'-01')-datetime.timedelta(days=1)).strftime('%Y-%m')
                prior=api('GET','receita',params={'mes':previous},client=driver_client)
                assert prior['de']==previous and 'anterior' not in prior
                api('GET','receita',params={'mes':old},client=driver_client,status=403)
                api('GET','receita',params={'de':previous,'ate':current},client=driver_client,status=403)
                api('GET','resumo',client=driver_client,status=403)
                api('GET','pdf-panorama',client=driver_client,status=403)
                api('PUT','nota',{'numero':'456','arquivo':'teste.pdf'},{'id':notes[0]['id']})
                edited_note=api('GET','notas',params={'viagem_id':d})[0]
                assert edited_note['numero']=='456' and edited_note['data']=='2026-10-09' and edited_note['viagem_id']==d

                assert api('GET', 'viagens', params={'id': a}, client=driver_client) == []
                api('POST', 'viagem-pagamento', {'integral':'1'}, {'id': a}, status=403, client=driver_client)
                own = api('POST', 'viagens', trip(cliente_novo='Cliente do motorista', valor_entrada='100'), client=driver_client)['id']
                api('POST', 'viagem-encerrar', {'fim':'2026-10-11', 'integral':'1'}, {'id':own}, client=driver_client)
                own_trip = api('GET', 'viagens', params={'id':own}, client=driver_client)[0]
                assert own_trip['usuario_id'] == driver and own_trip['recebido_centavos'] == 100000
                api('PUT', 'cliente', {'nome':'Cliente Teste', 'ativo':'0'}, {'id':client['id']})
                api('POST', 'viagens', trip(), status=400)
                assert get_trip(a)['cliente'] == 'Cliente Teste'
                # Paginação não repete páginas.
                page1 = api('GET', 'viagens', params={'limite':2,'pagina':1})
                page2 = api('GET', 'viagens', params={'limite':2,'pagina':2})
                assert not ({v['id'] for v in page1} & {v['id'] for v in page2})
                assert api('GET', 'resumo', params={'de':'2026-10','ate':'2026-10'})['a_receber']['a_receber_centavos'] == 300000
                # Prazo de 2 minutos: inclusive cadastros capturados offline há mais tempo.
                expired = api('POST','viagens',trip(cliente_novo='Prazo offline'),client=driver_client,registered=int((time.time()-180)*1000))['id']
                assert not api('GET','viagens',params={'id':expired},client=driver_client)[0]['pode_alterar']
                api('DELETE','viagem',params={'id':expired},client=driver_client,status=403)
                api('PUT','viagem',trip(),{'id':expired},client=driver_client,status=403)
                api('DELETE','viagem',params={'id':expired})
                fresh = api('POST','viagens',dict(origem='Fazenda A',destino='Armazém 3',inicio='2026-10-10'),client=driver_client)['id']
                api('DELETE','viagem',params={'id':fresh},client=driver_client)
                # Diárias: lote de dias úteis, seleção, histórico e correção pelo proprietário.
                work = {'usuario_id':driver,'de':'2026-10-05','ate':'2026-10-11','dias_semana':[1,2,3,4,5],'valor':'100'}
                result=api('POST','diarias',work,key='daily-batch-0001')
                assert result['criadas']==5, result
                assert api('POST','diarias',work)['ja_existiam']==5
                api('POST','diarias',dict(work,dias_semana=[]),status=400)
                days=api('GET','diarias',params={'mes':'2026-10','escopo':'pendentes','usuario_id':driver})['itens']
                selected=[d['id'] for d in days[:2]]
                category=next(c['id'] for c in api('GET','categorias') if c['nome']=='Diárias de motorista')
                payment=api('POST','diarias-pagar',{'usuario_id':driver,'ids':selected,'categoria_id':category,'data':'2026-10-15'},key='daily-payment-0001')
                assert payment['total_centavos']==20000 and payment['dias']==2
                again=api('POST','diarias-pagar',{'usuario_id':driver,'ids':selected,'categoria_id':category,'data':'2026-10-15'},key='daily-payment-0001')
                assert again['lancamento_id']==payment['lancamento_id']
                api('POST','diarias-pagar',{'usuario_id':driver,'ids':selected,'categoria_id':category},status=400)
                history=api('GET','diarias',params={'mes':'2026-10','usuario_id':driver})
                assert history['totais']['pago_centavos']==20000 and history['totais']['pendente_centavos']==30000
                assert len(history['pagamentos'])==1
                paid=next(d for d in history['itens'] if d['id']==selected[0])
                api('PUT','diaria',{'data':paid['data'],'valor':'150'},{'id':paid['id']})
                assert api('GET','lancamento',params={'id':payment['lancamento_id']})['valor_centavos']==25000
                api('DELETE','diaria',params={'id':paid['id']})
                assert api('GET','lancamento',params={'id':payment['lancamento_id']})['valor_centavos']==10000
                api('DELETE','diaria',params={'id':selected[1]})
                api('GET','lancamento',params={'id':payment['lancamento_id']},status=404)
                api('POST','diarias',{'usuario_id':driver,'de':'2026-09-30','valor':'150'})
                all_pending=api('GET','diarias',params={'escopo':'pendentes','usuario_id':driver})['itens']
                cross=[next(d['id'] for d in all_pending if d['data']=='2026-09-30'),next(d['id'] for d in all_pending if d['data'].startswith('2026-10'))]
                mixed=api('POST','diarias-pagar',{'usuario_id':driver,'ids':cross,'categoria_id':category,'data':'2026-10-16'},key='daily-cross-month-0001')
                assert mixed['dias']==2 and mixed['total_centavos']==25000
                assert api('GET','lancamento',params={'id':mixed['lancamento_id']})['descricao'].startswith('Diárias de motorista')
                with sqlite3.connect(base / 'test.sqlite') as clock_db:
                    clock_db.execute("UPDATE usuarios SET ativo=0 WHERE id=?",[driver])
                clock_db.close()
                owed=api('GET','diarias',params={'mes':'2026-11','escopo':'pendentes'})
                assert any(m['usuario_id']==driver and m['pendente_geral_centavos']==20000 for m in owed['motoristas'])
                # Banco antigo: importa cliente e liga viagem sem apagar fretes/receitas.
                with sqlite3.connect(base / 'test.sqlite') as db:
                    legacy = db.execute("INSERT INTO viagens (usuario_id,origem,destino,inicio,status,criado_em) VALUES (1,'Antiga','Rota','2026-08-01','encerrada','2026-08-01 08:30:00')").lastrowid
                    category = db.execute("SELECT id FROM categorias WHERE tipo='entrada' LIMIT 1").fetchone()[0]
                    db.execute("INSERT INTO recebiveis (cliente,categoria_id,valor_centavos,data,viagem_id,criado_em) VALUES (?,?,?,?,?,?)", ('Cliente importado',category,50000,'2026-08-01',legacy,'2026-08-01 08:30:00'))
                    db.execute('UPDATE esquema SET versao=3')
                db.close()
                imported = api('GET','clientes')
                assert any(c['nome']=='Cliente importado' for c in imported)
                assert get_trip(legacy)['cliente']=='Cliente importado'
                assert get_trip(a)['recebido_centavos']==100000
                assert get_trip(legacy)['criado_em']=='2026-08-01 08:30:00'
                # Categoria configurável, ordem atômica e filtros financeiros consistentes.
                nova = api('POST','categorias',{'nome':'Controle diesel teste','tipo':'saida','icone':'combustivel','pede_litros':True,'pede_descricao':True})
                cats=api('GET','categorias',params={'todos':'1'})
                registro=next(x for x in cats if x['id']==nova['id'])
                assert int(registro['pede_litros'])==1 and int(registro['pede_descricao'])==1
                ids=[x['id'] for x in cats if x['tipo']=='saida'][::-1]
                api('PUT','categorias-ordem',{'tipo':'saida','ids':ids})
                cats=api('GET','categorias',params={'todos':'1'})
                assert all(int(x['ordem'])==ids.index(x['id'])+1 for x in cats if x['tipo']=='saida')
                api('PUT','categorias-ordem',{'tipo':'saida','ids':[ids[0],ids[0]]},status=400)
                api('PUT','categorias-ordem',{'tipo':'saida','ids':ids[:-1]},status=409)
                assert cats==api('GET','categorias',params={'todos':'1'})
                vazio=api('GET','resumo',params={'de':'2026-10','ate':'2026-10','usuario_id':999999})
                assert vazio['atual']['qtd']==0 and not vazio['por_dia'] and not vazio['por_caminhao']
                catEntrada=next(x['id'] for x in cats if x['tipo']=='entrada')
                filtrado=api('GET','resumo',params={'de':'2026-10','ate':'2026-10','categoria_id':catEntrada})
                assert filtrado['atual']['saidas_centavos']==0 and not filtrado['saidas_por_categoria']
                assert all(int(d['saidas_centavos'])==0 for d in filtrado['por_dia'])
                api('GET','resumo',params={'de':'2026-10','ate':'2026-10','usuario_id':'1 OR 1=1'},status=400)
                print('OK: migração, endereço, viagens, pagamentos, prazo de 2 minutos, diárias em lote, seleção, histórico, correções, idempotência, rollback e permissões.')
            finally:
                server.terminate()
                server.wait(timeout=10)
                errors = (base / 'server.log').read_text(errors='replace')
                if '[frota]' in errors or 'Fatal error' in errors:
                    print(errors)


if __name__ == '__main__':
    main()
