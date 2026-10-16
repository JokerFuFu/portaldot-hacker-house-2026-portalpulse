import {createExecutionReport} from '../core/execution-report.js';
import type {ExecutionReport} from '../core/execution-report.js';
import {makeDemoExecutionEvidence} from '../demo/execution.js';
import {readExecutionInput} from './execution-model.js';
import type {ExecutionInputKind} from './execution-model.js';

export interface ExecutionSessionState {
 report:ExecutionReport|null;
 inputKind:ExecutionInputKind|null;
 busy:boolean;
 error:string|null;
}

export function createExecutionSession(onChange:(state:ExecutionSessionState)=>void) {
 let generation=0,disposed=false;
 let state:ExecutionSessionState={report:null,inputKind:null,busy:false,error:null};
 function publish(next:ExecutionSessionState) {state=next;onChange(next);}
 async function run(read:()=>Promise<{report:ExecutionReport;inputKind:ExecutionInputKind}>) {
  if(disposed)return;
  const token=++generation;
  publish({...state,busy:true,error:null});
  try {
   const next=await read();
   if(disposed||token!==generation)return;
   publish({...next,busy:false,error:null});
  } catch(error) {
   if(disposed||token!==generation)return;
   publish({...state,busy:false,error:'导入失败：'+(error instanceof Error?error.message:'无法读取执行证据')});
  }
 }
 return {
  load:(read:()=>Promise<string>)=>run(async()=>readExecutionInput(await read())),
  simulated:()=>run(async()=>({report:await createExecutionReport(makeDemoExecutionEvidence()),inputKind:'simulated'})),
  clear() {
   if(disposed)return;
   generation++;
   publish({report:null,inputKind:null,busy:false,error:null});
  },
  dispose() {generation++;disposed=true;},
 };
}
