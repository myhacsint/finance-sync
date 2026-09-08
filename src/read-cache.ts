/** Bounded, epoch-aware read cache. Values retain their original evidence timestamp. */
export class ReadCache<T> {
  private rows=new Map<string,{epoch:string;at:number;value:T}>();
  constructor(private ttlMs=60_000,private limit=12){}
  get(key:string,epoch:string,now=Date.now()):T|undefined {
    const row=this.rows.get(key);
    if(!row)return;
    if(row.epoch!==epoch||now-row.at>=this.ttlMs){this.rows.delete(key);return;}
    return row.value;
  }
  set(key:string,epoch:string,value:T,now=Date.now()) {
    this.rows.delete(key);
    while(this.rows.size>=this.limit)this.rows.delete(this.rows.keys().next().value!);
    this.rows.set(key,{epoch,at:now,value});
  }
  clear(){this.rows.clear();}
}
