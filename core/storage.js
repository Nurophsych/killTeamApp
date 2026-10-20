/* Persistent local IndexedDB: each team has independent catalog, battle, and undo history. */
const NAME='killteam-dataslate-offline-v2',STORE='records';
let opened;
function db(){
 if(!opened)opened=new Promise((resolve,reject)=>{
  const request=indexedDB.open(NAME,1);
  request.onupgradeneeded=()=>{const d=request.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE)};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });return opened;
}
export async function get(key){const d=await db();return new Promise((resolve,reject)=>{
 const tx=d.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(key);
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
export async function put(key,value){const d=await db();return new Promise((resolve,reject)=>{
 const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);
 tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
});}
export async function remove(key){const d=await db();return new Promise((resolve,reject)=>{
 const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);
 tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
});}
