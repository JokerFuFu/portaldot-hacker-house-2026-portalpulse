import {createHash} from 'node:crypto';
import solc from 'solc';

const VERSION='0.8.24+commit.e11b9ed9.Emscripten.clang';
const digest=text=>createHash('sha256').update(text).digest('hex');

/** Local compiler only. An artifact is not evidence of Portaldot execution. */
export function compileProbe(source){
  const version=solc.version();
  if(version!==VERSION)throw new Error('Unsupported Solidity compiler build');
  const settings={
    optimizer:{enabled:true,runs:200},evmVersion:'paris',metadata:{bytecodeHash:'none'},
    outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.methodIdentifiers'],'':['ast']}},
  };
  const input={language:'Solidity',sources:{'PortalPulseProbe.sol':{content:source}},settings};
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const errors=(output.errors??[]).filter(error=>error.severity==='error');
  if(errors.length)throw new Error('Probe compilation error: '+errors.map(error=>error.formattedMessage).join('\n'));
  const contract=output.contracts?.['PortalPulseProbe.sol']?.PortalPulseProbe;
  const creation=contract?.evm?.bytecode?.object,runtime=contract?.evm?.deployedBytecode?.object;
  if(!creation||!runtime||!/^([0-9a-f]{2})+$/i.test(creation)||!/^([0-9a-f]{2})+$/i.test(runtime)){
    throw new Error('Probe compilation did not produce complete linked bytecode');
  }
  const ast=output.sources?.['PortalPulseProbe.sol']?.ast;
  const definition=ast?.nodes?.find(node=>node.nodeType==='ContractDefinition'&&node.name==='PortalPulseProbe');
  const event=definition?.nodes?.find(node=>node.nodeType==='EventDefinition'&&node.name==='SequenceRecorded');
  if(!/^[0-9a-f]{64}$/i.test(event?.eventSelector??''))throw new Error('Probe compilation missing event selector');
  return {
    artifactVersion:1,contractName:'PortalPulseProbe',sourceSha256:digest(source),
    compiler:{version,settings},abi:contract.abi,
    creationBytecode:'0x'+creation,runtimeBytecode:'0x'+runtime,
    creationBytecodeSha256:digest(Buffer.from(creation,'hex')),
    runtimeBytecodeSha256:digest(Buffer.from(runtime,'hex')),
    methodIdentifiers:contract.evm.methodIdentifiers,
    eventSelectors:{SequenceRecorded:'0x'+event.eventSelector},
  };
}
