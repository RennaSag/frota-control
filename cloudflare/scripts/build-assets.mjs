import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(project,'../frota'), target=path.resolve(project,'public');
if(path.dirname(target)!==project || path.basename(target)!=='public')throw new Error('Destino inválido.');
await fs.mkdir(path.join(target,'assets'),{recursive:true});
for(const entry of await fs.readdir(path.join(source,'assets'),{withFileTypes:true})){
  if(entry.isFile() && /\.(?:js|css|png|svg|ico|woff2?)$/i.test(entry.name))await fs.copyFile(path.join(source,'assets',entry.name),path.join(target,'assets',entry.name));
}
await fs.copyFile(path.join(source,'sw.js'),path.join(target,'sw.js'));
let html=await fs.readFile(path.join(source,'index.php'),'utf8');
const version=/\$v\s*=\s*'([^']+)'/.exec(html)?.[1];
if(!version)throw new Error('Versão não encontrada no app.');
html=html.replace(/^<\?php[\s\S]*?\?>/,'').replaceAll('<?= $nome ?>','Controle da Frota').replaceAll('<?= $v ?>',version)
  .replace('<?= json_encode($ambiente) ?>','"__FROTA_AMBIENTE__"').replace('<?= json_encode(NOME_SISTEMA) ?>','"Controle da Frota"')
  .replace('<?= json_encode($v) ?>',JSON.stringify(version)).replace("<?= json_encode(conf('AMBIENTE', '') === 'demonstracao') ?>",'false');
if(html.includes('<?'))throw new Error('PHP inesperado no HTML público.');
await fs.writeFile(path.join(target,'index.html'),html);
await fs.writeFile(path.join(target,'_headers'),'/sw.js\n  Cache-Control: no-cache\n/assets/*\n  X-Content-Type-Options: nosniff\n');
console.log(`Assets ${version} preparados. PHP, bancos, uploads e dados de teste ficam fora do pacote público.`);
