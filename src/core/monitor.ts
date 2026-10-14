import type {Sample,MonitorCheck,MonitorSummary,BlockRef} from './types.js';

const check=(state:MonitorCheck['state'],reason:string):MonitorCheck=>({state,reason});
const hashPattern=/^0x[0-9a-fA-F]{64}$/;
function height(block:BlockRef|null):bigint|null {
  if(!block||!hashPattern.test(block.hash)||!hashPattern.test(block.parentHash)||
    !/^(0|[1-9][0-9]*)$/.test(block.number)||block.number.length>309)return null;
  return BigInt(block.number);
}
function identityComplete(sample:Sample):boolean {
  const i=sample.identity;
  return i.state==='normal'&&i.expectedGenesis!==null&&i.genesisHash!==null&&
    hashPattern.test(i.genesisHash)&&hashPattern.test(i.expectedGenesis)&&i.genesisHash.toLowerCase()===i.expectedGenesis.toLowerCase()&&
    !!i.chainName&&i.runtime!==null&&!!i.runtime.specName&&
    Number.isSafeInteger(i.runtime.specVersion)&&i.runtime.specVersion>=0&&
    Number.isSafeInteger(i.runtime.transactionVersion)&&i.runtime.transactionVersion>=0&&
    [13,14,15,16].includes(i.runtime.metadataVersion??-1)&&i.metadataVerified&&i.writeAllowed===false;
}
function median(values:number[]):number|null {
  if(values.length<3)return null;
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]!:(sorted[middle-1]!+sorted[middle]!)/2;
}
interface Progress {previous:bigint|null;changedAt:number|null;intervals:number[];regressed:boolean;}
const progress=():Progress=>({previous:null,changedAt:null,intervals:[],regressed:false});
function reset(p:Progress):void {p.previous=null;p.changedAt=null;p.intervals=[];}
function observe(p:Progress,value:bigint,time:number):void {
  if(p.previous!==null&&value<p.previous){p.regressed=true;reset(p);}
  if(p.previous===null)p.changedAt=time;
  else if(value>p.previous){
    const interval=time-p.changedAt!;
    if(interval<=0)reset(p);
    else p.intervals.push(interval);
    p.changedAt=time;
  }
  p.previous=value;
}
function summary(p:Progress,time:number,invalid:boolean,usable:boolean):MonitorCheck {
  if(invalid||p.regressed)return check('abnormal',invalid?'Finalized height exceeds best height':'Observed head regression in retained history');
  if(!usable)return check('unverified','Incomplete or failed observation resets progress baseline');
  const baseline=median(p.intervals);
  if(baseline===null)return check('unverified','Collecting at least three consecutive observed change intervals');
  const threshold=Math.max(180000,3*baseline);
  return time-p.changedAt!>threshold?check('abnormal',`No observed increase for more than ${threshold} ms`):
    check('normal','Observed progress within the sampled interval threshold');
}

export function retainSamples(samples:Sample[]):{samples:Sample[];dropped:number} {
  const dropped=Math.max(0,samples.length-2000);
  return {samples:samples.slice(dropped),dropped};
}

export function analyzeSamples(samples:Sample[],nowMs=Date.now(),intervalMs=10000):MonitorSummary {
  if(!Number.isFinite(nowMs))throw new Error('Invalid analysis time');
  if(!Number.isFinite(intervalMs)||intervalMs<=0)throw new Error('Invalid sampling interval');
  const latest=samples.at(-1)??null;
  const best=progress(),finalized=progress();
  let lastTime=-Infinity,genesis:string|null=null,identityChanged=false,impossible=false,usable=false,badTime=false;
  let session:string|null=null,seenBest:bigint|null=null,seenFinalized:bigint|null=null;
  for(const sample of samples){
    const time=Date.parse(sample.observedAt),b=height(sample.best),f=height(sample.finalized);
    const currentGenesis=sample.identity.genesisHash?.toLowerCase()??null;
    const currentSession=JSON.stringify([sample.configId,sample.endpointAlias,sample.origin,sample.identity.expectedGenesis]);
    const changed=(genesis!==null&&currentGenesis!==null&&genesis!==currentGenesis)||(session!==null&&session!==currentSession);
    if(changed){identityChanged=true;reset(best);reset(finalized);}
    if(currentGenesis!==null)genesis=currentGenesis;
    session=currentSession;
    const invalidTime=!Number.isFinite(time)||time<lastTime||time>nowMs;
    if(invalidTime)badTime=true;
    // Keep valid height evidence even when another request failed; only intervals reset.
    if(b!==null){if(seenBest!==null&&b<seenBest)best.regressed=true;seenBest=b;}
    if(f!==null){if(seenFinalized!==null&&f<seenFinalized)finalized.regressed=true;seenFinalized=f;}
    const invalidRelation=b!==null&&f!==null&&f>b;
    if(invalidRelation)impossible=true;
    usable=!invalidTime&&!invalidRelation&&identityComplete(sample)&&b!==null&&f!==null&&
      sample.rpc.length>0&&sample.rpc.every(record=>record.status==='normal'&&!record.error);
    if(!usable){reset(best);reset(finalized);}
    else{observe(best,b!,time);observe(finalized,f!,time);}
    lastTime=time;
  }
  const baselineMs=median(best.intervals),thresholdMs=Math.max(180000,3*(baselineMs??0));
  const reachability=latest===null?check('unverified','No completed observations'):
    latest.rpc.some(record=>record.status==='abnormal'||record.error)?check('abnormal','RPC failure preserved in the latest observation'):
    latest.rpc.length?check('normal','Latest recorded RPC requests completed'):check('unverified','No RPC evidence');
  const identity=identityChanged?check('abnormal','Identity or configuration changed in retained history'):
    latest===null?check('unverified','No identity evidence'):
    latest.identity.state==='abnormal'?check('abnormal',latest.identity.reason):
    identityComplete(latest)?check('normal',latest.identity.reason):check('unverified','Missing or unverified identity evidence');
  const freshness=latest===null?check('unverified','No collection time'):
    badTime?check('abnormal','Invalid, reordered or future collection time'):
    nowMs-lastTime>2*intervalMs+8000?check('abnormal','Last completed observation is stale'):
    check('normal','Last completed observation is within freshness window');
  const bestProgress=summary(best,lastTime,impossible,usable&&!identityChanged&&!badTime);
  const finalizedProgress=summary(finalized,lastTime,impossible,usable&&!identityChanged&&!badTime);
  return {reachability,identity,freshness,bestProgress,finalizedProgress,baselineMs,thresholdMs,latest};
}
