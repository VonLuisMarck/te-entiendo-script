import test from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionState, appOrigin } from '../supabase/functions/_shared/billing.ts';
import { normalizeListing } from '../supabase/functions/_shared/listing.ts';
const sub = (status='active', price='price_1SNVunIZNGNvNT1eDLHxmlM2', period=2000000000) => ({ id:'sub_fixture',status,items:{data:[{current_period_end:period,price:{id:price,product:'prod_fixture'}}]} });
test('billing uses item billing periods and a known price, never a client-supplied tier',()=>{
 assert.equal(subscriptionState([sub()], 1900000000000).tier,'basic');
 assert.equal(subscriptionState([sub('past_due')],1900000000000).tier,'free');
 assert.equal(subscriptionState([sub('active','price_foreign')],1900000000000).subscribed,false);
 assert.equal(subscriptionState([sub('active',undefined,1800000000)],1900000000000).tier,'free');
 assert.equal(subscriptionState([sub('canceled')],1900000000000).tier,'free');
});
test('checkout redirect origin is explicit configuration and validated',()=>{
 assert.equal(appOrigin('https://findoo.example/'),'https://findoo.example');
 for(const v of [undefined,'javascript:alert(1)','https://attacker@findoo.example/','https://findoo.example/path','http://public.example']) assert.throws(()=>appOrigin(v));
});
test('normalization preserves source price and known facts and leaves unknowns empty',()=>{
 const result=normalizeListing({external_id:'pisos-1',portal_origen:'pisos',url:'https://www.pisos.com/1',raw_data:{price:140000,municipality:'Murcia',property_type:'Apartment',size_m2:70,image_urls:['https://fixture.invalid/1.jpg','javascript:bad','https://fixture.invalid/1.jpg']}});
 assert.equal(result.precio,140000);assert.equal(result.precio_m2,2000);assert.equal(result.tiene_ascensor,null);
 assert.equal(result.ciudad,'Murcia');assert.equal(result.imagenes.length,1);
});
test('normalization rejects missing facts instead of filling them with invented defaults',()=>{
 const row={external_id:'fotocasa-1',raw_data:{transaction:{price:140000},propertyType:2}};
 assert.throws(()=>normalizeListing(row),/Ubicación/);
 assert.throws(()=>normalizeListing({...row,raw_data:{...row.raw_data,transaction:{price:0}}}),/Precio/);
});
