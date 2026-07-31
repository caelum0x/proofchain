/**
 * Pipeline registry.
 *
 * A `Pipeline` is a named, end-to-end verification flow (verification,
 * financing-eligibility, insurance-underwriting, dpp-issuance,
 * compliance-screening). Pipelines are stateless descriptors: `run` takes its
 * injected dependencies plus a request, so the same descriptor is reusable and
 * unit-testable with mocks. HTTP routes look pipelines up here by id.
 *
 * REGISTRATION CONVENTION
 *   Create `src/pipelines/<flow>.ts` that builds a `Pipeline` and calls
 *   `registerPipeline(...)`, then append a side-effect import to
 *   `src/pipelines/index.ts`. Never edit this file.
 */
import { createRegistry } from '../registry/registry.js';

export interface Pipeline<Deps = unknown, Req = unknown, Res = unknown> {
  /** Unique flow id AND registry key, e.g. "verification". */
  readonly id: string;
  readonly description: string;
  run(deps: Deps, req: Req): Promise<Res>;
}

export const pipelineRegistry = createRegistry<Pipeline>({
  label: 'pipeline',
  keyOf: (p) => p.id,
});

/** Register a pipeline (called by each `src/pipelines/<flow>.ts` module). */
export const registerPipeline = <Deps, Req, Res>(
  pipeline: Pipeline<Deps, Req, Res>,
): Pipeline<Deps, Req, Res> => {
  pipelineRegistry.register(pipeline as Pipeline);
  return pipeline;
};
