export type CheckStatus = 'normal'|'abnormal'|'unverified'|'collecting';
export type EvidenceOrigin = 'rpc'|'simulated';
export interface NetworkConfig {
  id:string; name:string; source:string; endpoint:string|null; endpointAlias:string;
  kind:'event-testnet'|'mainnet-readonly'|'custom-readonly'; expectedGenesis:string|null;
}
export interface RpcRecord {
  method:string; params:unknown[]; startedAt:string; durationMs:number;
  status:'normal'|'abnormal'; result?:unknown; error?:{code:string;message:string};
}
export interface RuntimeInfo {specName:string;specVersion:number;transactionVersion:number;metadataVersion:number|null;}
export interface Identity {
  state:CheckStatus; expectedGenesis:string|null; genesisHash:string|null; chainName:string|null;
  runtime:RuntimeInfo|null; declaredMethods:string[]; metadataVerified:boolean;
  reason:string; writeAllowed:false;
}
export interface BlockRef {hash:string;number:string;parentHash:string;}
export interface Sample {
  observedAt:string; endpointAlias:string; configId:string; origin:EvidenceOrigin;
  identity:Identity; best:BlockRef|null; finalized:BlockRef|null; rpc:RpcRecord[];
}
export interface ReadOnlyRpc {
  request(method:string,params?:unknown[],signal?:AbortSignal):Promise<unknown>;
  close():void;
}
export interface MonitorCheck {state:CheckStatus;reason:string;}
export interface MonitorSummary {
  reachability:MonitorCheck;identity:MonitorCheck;freshness:MonitorCheck;
  bestProgress:MonitorCheck;finalizedProgress:MonitorCheck;
  baselineMs:number|null;thresholdMs:number;latest:Sample|null;
}
export interface ReportPayload {
  origin:EvidenceOrigin;network:Omit<NetworkConfig,'endpoint'>;
  intervalMs:number;startedAt:string;endedAt:string;droppedSamples:number;samples:Sample[];
}
export interface SessionReport {schemaVersion:1;payload:ReportPayload;sha256:string;}
