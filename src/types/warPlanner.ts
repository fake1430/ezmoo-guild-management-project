export type WarPhaseId =
  | 'running-lines'
  | 'start'
  | '15-minutes'
  | '10-minutes';

export type WarAreaTone =
  | 'danger'
  | 'warning'
  | 'safe';

export type WarNoteTone =
  | 'note'
  | 'danger'
  | 'success';

export interface WarMapDefinition {
  id: string;
  label: string;
  image: string;
}

export interface WarMapPoint {
  xPercent: number;
  yPercent: number;
}

export interface WarPartyMarker {
  partyNo: number;
  xPercent: number;
  yPercent: number;
}

export interface WarRouteData {
  id: string;
  points: WarMapPoint[];
}

export interface WarNoteData {
  id: string;
  text: string;
  tone: WarNoteTone;
  xPercent: number;
  yPercent: number;
}

export interface WarAreaData {
  id: string;
  tone: WarAreaTone;
  centerXPercent: number;
  centerYPercent: number;
  radiusXPercent: number;
  radiusYPercent: number;
}

export type WarMarkersByPhase = Record<
  WarPhaseId,
  WarPartyMarker[]
>;

export type WarRoutesByPhase = Record<
  WarPhaseId,
  WarRouteData[]
>;

export type WarNotesByPhase = Record<
  WarPhaseId,
  WarNoteData[]
>;

export type WarAreasByPhase = Record<
  WarPhaseId,
  WarAreaData[]
>;

export interface WarPlannerData {
  mapId: string;
  markersByPhase: WarMarkersByPhase;
  routesByPhase: WarRoutesByPhase;
  notesByPhase: WarNotesByPhase;
  areasByPhase: WarAreasByPhase;
}