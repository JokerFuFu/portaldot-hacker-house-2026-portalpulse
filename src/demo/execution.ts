import type {ExecutionEvidence} from '../core/execution.js';

export const executionScenarios=[
 {id:'complete',label:'完整事实一致',description:'六阶段事实齐全且内部一致；仍是人工模拟，不是实链验证。'},
 {id:'missing-evidence',label:'缺少执行证据',description:'保留后续提供的事实；缺失的执行阶段及其后续结论保持未验证。'},
 {id:'execution-failed',label:'已纳入但执行失败',description:'交易已纳入，执行明确失败；不能因为存在后续记录就判成功。'},
 {id:'wrong-transaction',label:'成功事件属于其他交易',description:'提供了成功结果，但交易哈希不匹配；执行关联必须判异常。'},
 {id:'unfinalized',label:'尚未最终确认',description:'执行成功，最终确认及固定区块状态证据尚未提供；完整流程未验证。'},
 {id:'state-mismatch',label:'状态回读不匹配',description:'最终确认已提供，回读序号与预期相差1；保留两个精确整数。'},
] as const;

// Presets exercise the real evaluator without making any RPC or wallet request.
export function makeExecutionScenario(id:string='complete'):ExecutionEvidence {
 const e=makeDemoExecutionEvidence();
 switch(id) {
  case 'complete':break;
  case 'missing-evidence':e.execution=null;break;
  case 'execution-failed':e.execution!.outcome='failure';e.execution!.failureReason='Synthetic execution failure; no transaction sent';break;
  case 'wrong-transaction':e.execution!.transactionHash='0x'+'f'.repeat(64);break;
  case 'unfinalized':e.finality=null;e.readback=null;break;
  case 'state-mismatch':e.readback!.sequence='9007199254740992';break;
  default:throw new Error('Unknown execution scenario');
 }
 return e;
}

// Fixed synthetic facts only. Each invocation owns fresh nested objects and arrays.
export function makeDemoExecutionEvidence():ExecutionEvidence {
 return {
  "executionSchemaVersion": 1,
  "origin": "simulated",
  "network": {
    "id": "simulated-execution",
    "name": "Simulated execution fixture",
    "source": "Manually derived synthetic facts; not Portaldot observations",
    "endpointAlias": "simulated-offline",
    "kind": "event-testnet",
    "expectedGenesis": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "observedGenesis": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "intent": {
    "vm": "revive",
    "contract": "simulated-probe",
    "caller": "simulated-caller",
    "expectedSequence": "9007199254740993"
  },
  "submitted": {
    "transactionHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "observedAt": "2026-10-14T00:00:00.000Z"
  },
  "inclusion": {
    "transactionHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "block": {
      "hash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "number": "100",
      "parentHash": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
    },
    "transactionIndex": 0,
    "transactions": [
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    ],
    "observedAt": "2026-10-14T00:00:00.000Z"
  },
  "execution": {
    "transactionHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "blockHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "transactionIndex": 0,
    "outcome": "success",
    "failureReason": null,
    "observedAt": "2026-10-14T00:00:00.000Z"
  },
  "finality": {
    "genesisHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "finalized": {
      "hash": "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "number": "101",
      "parentHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    },
    "ancestry": [
      {
        "hash": "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "number": "101",
        "parentHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
      },
      {
        "hash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "number": "100",
        "parentHash": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      }
    ],
    "observedAt": "2026-10-14T00:00:00.000Z"
  },
  "readback": {
    "genesisHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "blockHash": "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    "contract": "simulated-probe",
    "caller": "simulated-caller",
    "sequence": "9007199254740993",
    "observedAt": "2026-10-14T00:00:00.000Z"
  }
};
}
