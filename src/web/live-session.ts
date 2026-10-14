import type {NetworkConfig, Sample, SessionReport, ReadOnlyRpc} from '../core/types.js';
import {validateNetworkConfig} from '../core/config.js';
import {createRpc} from '../core/rpc.js';
import {collectSample} from '../core/snapshot.js';
import {createReport} from '../core/report.js';

// One owner for transport, timer and generation: stopped/replaced sessions cannot publish.
export function createLiveSession() {
  let generation = 0;
  let controller: AbortController | null = null;
  let rpc: ReadOnlyRpc | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    generation++;
    controller?.abort();
    controller = null;
    rpc?.close();
    rpc = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  return {
    get active() {return controller !== null;},
    stop,
    start(config: NetworkConfig, onReport: (report: SessionReport) => void, onError: (message: string) => void) {
      stop();
      const fixed = validateNetworkConfig(config);
      if (!fixed.endpoint) throw new Error('请填写只读端点');
      const connection = createRpc(fixed.endpoint);
      const abort = new AbortController();
      const current = generation;
      rpc = connection;
      controller = abort;
      let samples: Sample[] = [];
      let dropped = 0;
      const valid = () => generation === current && !abort.signal.aborted;

      async function collect() {
        try {
          const sample = await collectSample(connection, fixed, {signal: abort.signal});
          if (!valid()) return;
          const report = await createReport(fixed, [...samples, sample], {
            origin: 'rpc', intervalMs: 10000, droppedSamples: dropped,
          });
          if (!valid()) return;
          // Keep the collector's history aligned with both report retention limits.
          samples = report.payload.samples;
          dropped = report.payload.droppedSamples;
          onReport(report);
        } catch (error) {
          if (valid()) onError(error instanceof Error ? error.message : '采集失败');
        }
        if (valid()) timer = setTimeout(() => {void collect();}, 10000);
      }
      void collect();
    },
  };
}
