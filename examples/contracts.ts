/** Domain boundary examples. JSON Schema files are authoritative for complete DTOs. */
export type Stat = 'hp'|'spd'|'ea'|'pa'|'ed'|'pd';
export type Stats = Record<Stat, number>;
export type Element = 'fire'|'water'|'nature'|'earth'|'lightning'|'wind';
export type Rarity = 'common'|'rare'|'epic'|'exotic'|'legendary';
export type QualityColor = 'red'|'white'|'green';
export interface Versions { datasetVersion: string; rulesVersion: string }
export interface Family {
  id: string; slug: string; name: string; aliases: string[];
  elements: Element[]; rarity: Rarity; baseRanks: Stats; formIds: string[];
}
export interface CatalogQuery {
  q?: string; elements?: Element[]; elementMode?: 'any'|'all'|'exact';
  rarity?: Rarity[]; baseRanks?: Partial<Record<Stat,{min?:number;max?:number}>>;
  abilityTags?: string[]; abilityTagMode?: 'any'|'all'; abilityName?: string;
  caught?: 'all'|'caught'|'missing'; favoritesOnly?: boolean;
  locationIds?: string[]; areaIds?: string[]; weekdays?: number[];
  acquisition?: 'wild'|'shop'|'unknown';
  variant?: 'base'|'dark'|'light'|'blighted'|'foil';
  sort?: string; cursor?: string; limit?: number;
}
export interface ListResult<T> { items:T[]; total:number; nextCursor:string|null; datasetVersion:string }
export interface BuildPreset extends Versions {
  id:string; familyId:string; label:string; level:number;
  colors:Record<Stat,QualityColor>; bonuses:Stats; relicIds:(string|null)[];
}
export interface CollectionEntry {
  familyId:string; everCaught:boolean; obtainedFormIds:string[];
  currentOwnedCount:number|null; favorite:boolean; note:string;
  updatedAt:string; localRevision:number; deletedAt:string|null;
}
export interface DomainError { code:string; message:string; details?:Record<string,unknown> }
export interface CatalogRepository {
  listFamilies(query:CatalogQuery, signal?:AbortSignal):Promise<ListResult<Family>>;
  getFamily(id:string, signal?:AbortSignal):Promise<Family|null>;
}
export interface ProfileRepository {
  getEntry(familyId:string):Promise<CollectionEntry|null>;
  patchEntry(familyId:string, patch:Partial<Pick<CollectionEntry,'everCaught'|'obtainedFormIds'|'currentOwnedCount'|'favorite'|'note'>>, expectedRevision:number|null):Promise<CollectionEntry>;
  savePreset(preset:BuildPreset):Promise<void>;
  exportProfile():Promise<unknown>;
  // Parse/validate/preview is separate from committing an import.
  previewImport(json:unknown):Promise<{added:number;conflicts:number;unknown:number;token:string}>;
  commitImport(token:string,mode:'merge'|'replace'):Promise<void>;
}
/** Domain coordinates: normalized across whole map. Image rect excludes letterboxing. */
export interface MapPoint {x:number;y:number;anchor:'bottom-center'}
/** Never evaluate formula strings from JSON; dispatch to versioned local implementations. */
export type CalculationOutcome<T> =
 | {status:'supported';modelId:string;rulesVersion:string;value:T;assumptions:string[]}
 | {status:'partial';modelId:string;rulesVersion:string;value:T;unhandledEffects:string[]}
 | {status:'unsupported';reason:string};
