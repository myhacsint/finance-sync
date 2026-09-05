import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'finance-ui-qa-'));
for (const kind of ['data','archive','inbox','secrets','backup']) {
  mkdirSync(join(root,kind),{mode:0o700});
  process.env['FINANCE_'+kind.toUpperCase()+'_DIR']=join(root,kind);
}
process.env.PORT='18083';
writeFileSync(join(root,'secrets','admin-token'),'synthetic-browser-test',{mode:0o600});
process.on('exit',()=>rmSync(root,{recursive:true,force:true}));
await import('../dist/server.js');
