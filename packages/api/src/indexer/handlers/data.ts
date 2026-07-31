/**
 * Data / oracle group handler.
 *
 * Owns `src/data/*` (IoT sensor registry, quality inspection, lab-test
 * attestation, oracle aggregator, data marketplace). Beyond the audit table it
 * projects two read models:
 *   - IoTSensorRegistry → `sensors` (`SensorRegistered` establishes the device;
 *     `SensorCommissioned` binds it to a batch; `SensorCompromised` faults it).
 *   - QualityInspection → `inspections` (`InspectionOpened` establishes the
 *     inspection; `InspectionRecorded` records the outcome).
 */
import type { DecodedEvent, HandlerDeps } from '../types.js';
import { makeHandler, type Projector } from './base.js';
import { asNumber, lower, str } from './util.js';

/** Contracts routed to this handler (feeds the derived contract→group table). */
const CONTRACTS: readonly string[] = [
  'IoTSensorRegistry',
  'QualityInspection',
  'LabTestAttestation',
  'OracleAggregator',
  'DataMarketplace',
];

type SensorRow = {
  id: string;
  device_id: string;
  batch_id: string | null;
  status: string;
  metadata: Record<string, unknown>;
};

type InspectionRow = {
  id: string;
  batch_id: string | null;
  inspector: string | null;
  result: string;
  report_uri: string | null;
  metadata: Record<string, unknown>;
};

/**
 * On-chain `InspectionOutcome` enum value → `inspections.result` vocabulary.
 * Numeric values mirror the Solidity enum order (`Pending=0, Passed=1, Failed=2,
 * Conditional=3`); `Conditional` maps to the read model's `waived`.
 */
const INSPECTION_RESULT: Readonly<Record<number, string>> = Object.freeze({
  0: 'pending',
  1: 'passed',
  2: 'failed',
  3: 'waived',
});

const projectSensor = async (
  event: DecodedEvent,
  deps: HandlerDeps,
): Promise<void> => {
  const sensorId = lower(event.args.sensorId);
  if (sensorId === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'data: sensor event missing sensorId; skipping projection',
    );
    return;
  }

  if (event.eventName === 'SensorRegistered') {
    await deps.db.upsert<SensorRow>(
      'sensors',
      {
        id: sensorId,
        device_id: sensorId,
        batch_id: null,
        status: 'active',
        metadata: {
          ...('owner' in event.args ? { owner: lower(event.args.owner) } : {}),
          ...('sensorType' in event.args ? { sensorType: event.args.sensorType } : {}),
        },
      },
      'id',
    );
    return;
  }

  if (event.eventName === 'SensorCommissioned' || event.eventName === 'SensorCompromised') {
    const existing = await deps.db.getBy<SensorRow>('sensors', 'id', sensorId);
    if (existing === null) {
      deps.logger.warn(
        { event: event.eventName, sensorId },
        'data: sensor transition for unknown sensor; audit-only',
      );
      return;
    }
    const patch =
      event.eventName === 'SensorCommissioned'
        ? { batch_id: lower(event.args.assetId) ?? existing.batch_id }
        : { status: 'faulty' };
    await deps.db.upsert<SensorRow>('sensors', { ...existing, ...patch }, 'id');
  }
};

const projectInspection = async (
  event: DecodedEvent,
  deps: HandlerDeps,
): Promise<void> => {
  const inspectionId = lower(event.args.inspectionId);
  if (inspectionId === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'data: inspection event missing inspectionId; skipping projection',
    );
    return;
  }

  if (event.eventName === 'InspectionOpened') {
    await deps.db.upsert<InspectionRow>(
      'inspections',
      {
        id: inspectionId,
        batch_id: lower(event.args.lotId) ?? null,
        inspector: lower(event.args.inspector) ?? null,
        result: 'pending',
        report_uri: null,
        metadata: 'standard' in event.args ? { standard: event.args.standard } : {},
      },
      'id',
    );
    return;
  }

  if (event.eventName === 'InspectionRecorded') {
    const existing = await deps.db.getBy<InspectionRow>('inspections', 'id', inspectionId);
    if (existing === null) {
      deps.logger.warn(
        { event: event.eventName, inspectionId },
        'data: InspectionRecorded for unknown inspection; audit-only',
      );
      return;
    }
    const result = INSPECTION_RESULT[asNumber(event.args.outcome) ?? -1] ?? existing.result;
    const metadata: Record<string, unknown> = {
      ...existing.metadata,
      ...('defectPpm' in event.args ? { defectPpm: event.args.defectPpm } : {}),
      ...('evidenceHash' in event.args ? { evidenceHash: str(event.args.evidenceHash) } : {}),
    };
    await deps.db.upsert<InspectionRow>(
      'inspections',
      { ...existing, result, metadata },
      'id',
    );
  }
};

const projectData: Projector = async (event: DecodedEvent, deps: HandlerDeps) => {
  if (!deps.db.isConfigured) return;
  const contract: string = event.contract; // widen for sound literal comparison
  if (contract === 'IoTSensorRegistry') {
    await projectSensor(event, deps);
    return;
  }
  if (contract === 'QualityInspection') {
    await projectInspection(event, deps);
  }
};

export default makeHandler('data', projectData, CONTRACTS);
