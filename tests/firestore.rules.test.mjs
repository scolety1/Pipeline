import {before, after, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc} from 'firebase/firestore';

let env;
before(async () => {
  // Fail closed: never infer a live project or a remote database endpoint.
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088');
  env = await initializeTestEnvironment({projectId:'demo-pipeline-rules',firestore:{
    host:'127.0.0.1', port:8088, rules:await readFile('firestone.rules','utf8')
  }});
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    for(const kind of ['applications','contacts'])
      await setDoc(doc(context.firestore(),`users/alice/${kind}/existing`),{name:'Synthetic fixture'});
  });
});
after(async () => {if(env) await env.cleanup();});

for(const kind of ['applications','contacts']) {
  test(`${kind}: owner can create, list, read, update and delete`,async()=>{
    const db=env.authenticatedContext('alice').firestore();
    const record=doc(db,`users/alice/${kind}/new`);
    await assertSucceeds(setDoc(record,{name:'Synthetic fixture'}));
    await assertSucceeds(getDocs(collection(db,`users/alice/${kind}`)));
    await assertSucceeds(getDoc(record));
    await assertSucceeds(updateDoc(record,{name:'Updated synthetic fixture'}));
    await assertSucceeds(deleteDoc(record));
  });
  for(const identity of ['bob',null]) test(`${kind}: ${identity??'anonymous'} denied all access`,async()=>{
    const db=(identity?env.authenticatedContext(identity):env.unauthenticatedContext()).firestore();
    const record=doc(db,`users/alice/${kind}/existing`);
    await assertFails(getDoc(record));
    await assertFails(getDocs(collection(db,`users/alice/${kind}`)));
    await assertFails(setDoc(doc(db,`users/alice/${kind}/new`),{name:'Synthetic'}));
    await assertFails(updateDoc(record,{name:'Changed'}));
    await assertFails(deleteDoc(record));
  });
}
test('unlisted collections and server rate limit records stay denied',async()=>{
  const db=env.authenticatedContext('alice').firestore();
  for(const path of ['users/alice/unknown/x','users/alice/contacts/x/nested/y','emailDraftRateLimits/alice']){
    await assertFails(getDoc(doc(db,path)));
    await assertFails(setDoc(doc(db,path),{synthetic:true}));
  }
});
