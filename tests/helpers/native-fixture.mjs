// Artificial metadata and unsigned byte fixtures. No Portaldot transaction or account.
import {Metadata, TypeRegistry} from '@polkadot/types';
import {blake2AsHex} from '@polkadot/util-crypto';
export const genesis='0x'+'11'.repeat(32);
export const parent='0x'+'22'.repeat(32);
export const eventsKey='0x26aa394eea5630e07c48ae0c9558cef780d41e5e16056765bc8461851072c9d7';
const field=(name,type)=>({name,type,typeName:null,docs:[]});
const variant=(name,index,fields=[])=>({name,index,fields,docs:[]});
export function syntheticMetadata() {
  const types=[];
  function add(path,def,params=[]){const id=types.length;types.push({id,type:{path,params,def,docs:[]}});return id;}
  add([],{primitive:'U32'}); //0
  add([],{primitive:'U8'}); //1
  add(['primitive_types','H256'],{array:{len:32,type:1}}); //2
  add(['sp_runtime','DispatchError'],{variant:{variants:[variant('Other',0),variant('BadOrigin',2)]}}); //3
  add(['frame_support','dispatch','DispatchInfo'],{composite:{fields:[field('weight',5)]}}); //4
  add([],{primitive:'U64'}); //5
  add(['frame_system','pallet','Event'],{variant:{variants:[
    variant('ExtrinsicSuccess',0,[field('dispatch_info',4)]),
    variant('ExtrinsicFailed',1,[field('dispatch_error',3),field('dispatch_info',4)]),
  ]}}); //6
  add(['synthetic_runtime','RuntimeEvent'],{variant:{variants:[variant('System',0,[field(null,6)])]}}); //7
  add(['frame_system','Phase'],{variant:{variants:[variant('ApplyExtrinsic',0,[field(null,0)]),variant('Finalization',1),variant('Initialization',2)]}}); //8
  add(['frame_system','EventRecord'],{composite:{fields:[field('phase',8),field('event',7),field('topics',10)]}},[{name:'E',type:7},{name:'T',type:2}]); //9
  add([],{sequence:{type:2}}); //10
  add([],{sequence:{type:9}}); //11
  add(['synthetic_runtime','RuntimeCall'],{variant:{variants:[variant('System',0,[field(null,13)])]}}); //12
  add(['frame_system','pallet','Call'],{variant:{variants:[variant('remark',0,[field('remark',14)])]}}); //13
  add([],{sequence:{type:1}}); //14
  add(['sp_runtime','generic','unchecked_extrinsic','UncheckedExtrinsic'],{composite:{fields:[]}},[{name:'Address',type:2},{name:'Call',type:12},{name:'Signature',type:2},{name:'Extra',type:16}]); //15
  add([],{tuple:[]}); //16
  add(['synthetic_runtime','Runtime'],{composite:{fields:[]}}); //17
  const registry=new TypeRegistry();
  const metadata=new Metadata(registry,{magicNumber:0x6174656d,metadata:{V14:{
    lookup:{types},
    pallets:[{name:'System',index:0,storage:{prefix:'System',items:[{name:'Events',modifier:'Default',type:{Plain:11},fallback:'0x00',docs:[]}]},calls:{type:13},events:{type:6},constants:[],errors:null}],
    extrinsic:{type:15,version:4,signedExtensions:[]},type:17,
  }}});
  registry.setMetadata(metadata);
  return {registry,metadataHex:metadata.toHex()};
}
export function nativeFixture({outcomes=[{index:1,success:true}],extrinsics=['0x1004000000','0x1004000001']}={}) {
  const {registry,metadataHex}=syntheticMetadata();
  // A real SCALE Vec<EventRecord>, with independently specified little-endian fields.
  const records=outcomes.map(({index,success,phase='ApplyExtrinsic'})=>{
    const position=Buffer.alloc(4);position.writeUInt32LE(index);
    const prefix=phase==='Finalization'?'01':phase==='Initialization'?'02':'00'+position.toString('hex');
    const outcome=success?'0000'+'00'.repeat(8):'0001'+'02'+'00'.repeat(8);
    return prefix+outcome+'00';
  });
  if(records.length>=64)throw Error('Small synthetic fixture only');
  const eventHex='0x'+(records.length*4).toString(16).padStart(2,'0')+records.join('');
  const header={parentHash:parent,number:'0x0a',stateRoot:'0x'+'33'.repeat(32),extrinsicsRoot:'0x'+'44'.repeat(32),digest:{logs:[]}};
  const blockHash=blake2AsHex(registry.createType('Header',header).toU8a(),256);
  const transactionHash=blake2AsHex(extrinsics[1]??extrinsics[0]??'0x00',256);
  const runtime={specName:'synthetic-runtime',specVersion:1,transactionVersion:1};
  const config={id:'test-native',name:'Artificial local fixture',source:'Test-only synthetic metadata and RPC',endpoint:'http://127.0.0.1:1',endpointAlias:'local-fixture',kind:'event-testnet',expectedGenesis:genesis};
  const calls=[];
  const replies={
    chain_getBlockHash:()=>genesis,
    chain_getBlock:()=>({block:{header:structuredClone(header),extrinsics:[...extrinsics]},justifications:null}),
    state_getRuntimeVersion:()=>structuredClone(runtime),
    state_getMetadata:()=>metadataHex,
    state_getStorage:()=>eventHex,
  };
  const rpc={async request(method,params=[],signal){calls.push({method,params});if(signal?.aborted)throw Error('Request aborted');if(!replies[method])throw Error('Unexpected method '+method);return replies[method](params);},close(){}};
  return {registry,metadataHex,eventHex,header,blockHash,transactionHash,runtime,config,rpc,replies,calls,extrinsics};
}
