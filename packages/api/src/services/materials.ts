/**
 * Materials service — DPP material compositions (MaterialComposition).
 *
 * A thin domain binding over the shared resource engine (see
 * `./support/resourceService.ts`): it pins the row DTO and the
 * table / id / searchable columns, and exposes the uniform list/search/detail
 * surface consumed by `../routes/materials.ts`. All read/aggregation logic
 * lives in the engine; this file adds only the domain's types.
 */
import { defineResourceService } from './support/resourceService.js';

/** A material composition row as stored in the `material_compositions` read model. */
export interface MaterialsRow {
  readonly material_id: string;
  readonly token_id: string | null;
  readonly material: string | null;
  readonly percentage: string | null;
  readonly origin: string | null;
  readonly hazardous: boolean | null;
  readonly recyclable: boolean | null;
  readonly created_at: string | null;
}

/** Build the Material composition service bound to the request context. */
export const createMaterialsService = defineResourceService<MaterialsRow>({
  table: 'material_compositions',
  idColumn: 'material_id',
  searchColumns: ['material', 'origin'],
});
