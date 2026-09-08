import test from 'node:test';
import assert from 'node:assert/strict';
import {FinanceDatabase} from './database.js';
import {validateView,saveView,listSavedViews,deleteView} from './saved-views.js';
test('saved views are bounded filter recipes, never arbitrary URLs or search text',()=>{
 const db=new FinanceDatabase(':memory:');
 try{
 const row=saveView(db,{name:'Haushalt',filters:{period:'ytd',year:'2026',account:'all'}});
 assert.equal(listSavedViews(db).length,1);
 assert.throws(()=>saveView(db,{name:'Haushalt',filters:{}}));
 for(const input of [{name:'<script>',filters:{}},{name:'x',filters:{search:'private'}},{name:'x',filters:{url:'https://outside'}},{name:'x',filters:{account:'private-id'}},{name:'x',filters:{month:'2026-99'}}])assert.throws(()=>validateView(input));
 deleteView(db,row.id);assert.equal(listSavedViews(db).length,0);
 }finally{db.db.close();}
});
