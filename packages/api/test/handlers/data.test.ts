import { describe, expect, it } from 'vitest';
import data from '../../src/indexer/handlers/data.js';
import { makeDeps, makeEvent } from './kit.js';

const SENSOR = ('0x' + 'a5'.repeat(32)) as `0x${string}`;
const ASSET = ('0x' + '11'.repeat(32)) as `0x${string}`;
const INSPECTION = ('0x' + 'c5'.repeat(32)) as `0x${string}`;
const LOT = ('0x' + '22'.repeat(32)) as `0x${string}`;
const OWNER = '0x0000000000000000000000000000000000000A99';
const DEVICE_KEY = '0x0000000000000000000000000000000000000B88';
const INSPECTOR = '0x0000000000000000000000000000000000000C77';
const STANDARD = ('0x' + '00'.repeat(30) + 'abcd') as `0x${string}`;

describe('data handler', () => {
  it('declares its owned contracts and group', () => {
    expect(data.group).toBe('data');
    expect(data.contracts).toContain('IoTSensorRegistry');
    expect(data.contracts).toContain('DataMarketplace');
  });

  it('projects a SensorRegistered into sensors (status=active)', async () => {
    const { db, deps } = makeDeps();
    await data.handle(
      makeEvent({
        contract: 'IoTSensorRegistry',
        eventName: 'SensorRegistered',
        args: { sensorId: SENSOR, owner: OWNER, deviceKey: DEVICE_KEY, sensorType: 0 },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'sensors');
    expect(row?.row.id).toBe(SENSOR.toLowerCase());
    expect(row?.row.device_id).toBe(SENSOR.toLowerCase());
    expect(row?.row.status).toBe('active');
    expect((row?.row.metadata as Record<string, unknown>).owner).toBe(OWNER.toLowerCase());
  });

  it('binds a sensor to a batch on SensorCommissioned', async () => {
    const { db, deps } = makeDeps();
    db.seed('sensors', SENSOR.toLowerCase(), {
      id: SENSOR.toLowerCase(),
      device_id: SENSOR.toLowerCase(),
      status: 'active',
      batch_id: null,
    });
    await data.handle(
      makeEvent({
        contract: 'IoTSensorRegistry',
        eventName: 'SensorCommissioned',
        args: { sensorId: SENSOR, assetId: ASSET },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'sensors');
    expect(row?.row.batch_id).toBe(ASSET.toLowerCase());
  });

  it('faults a sensor on SensorCompromised', async () => {
    const { db, deps } = makeDeps();
    db.seed('sensors', SENSOR.toLowerCase(), { id: SENSOR.toLowerCase(), status: 'active' });
    await data.handle(
      makeEvent({
        contract: 'IoTSensorRegistry',
        eventName: 'SensorCompromised',
        args: { sensorId: SENSOR, reason: STANDARD },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'sensors');
    expect(row?.row.status).toBe('faulty');
  });

  it('projects an InspectionOpened then records a failed outcome', async () => {
    const { db, deps } = makeDeps();
    await data.handle(
      makeEvent({
        contract: 'QualityInspection',
        eventName: 'InspectionOpened',
        args: { inspectionId: INSPECTION, lotId: LOT, inspector: INSPECTOR, standard: STANDARD },
      }),
      deps,
    );
    let row = db.upserts.find((u) => u.table === 'inspections');
    expect(row?.row.result).toBe('pending');
    expect(row?.row.batch_id).toBe(LOT.toLowerCase());

    await data.handle(
      makeEvent({
        contract: 'QualityInspection',
        eventName: 'InspectionRecorded',
        args: { inspectionId: INSPECTION, outcome: 2, defectPpm: 500, evidenceHash: STANDARD },
      }),
      deps,
    );
    row = [...db.upserts].reverse().find((u) => u.table === 'inspections');
    expect(row?.row.result).toBe('failed'); // InspectionOutcome.Failed(2)
    expect((row?.row.metadata as Record<string, unknown>).defectPpm).toBe(500);
  });
});
