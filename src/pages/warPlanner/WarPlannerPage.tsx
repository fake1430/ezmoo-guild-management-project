import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  FormEvent as ReactFormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import { toBlob } from 'html-to-image';

import { useParties } from '../../hooks/useParties';
import {
  getWarPlanner,
  saveWarPlanner,
} from '../../services/googleApi';
import type { WarPlannerData } from '../../types/warPlanner';
import fallenValkyrieMap from '../../assets/warPlanner/fallen-valkyrie.png';
import stellarClashMap from '../../assets/warPlanner/stellar-clash.png';
import valeOfClashMap from '../../assets/warPlanner/vale-of-clash.png';

interface WarMapDefinition {
  id: string;
  label: string;
  image: string;
}

const WAR_MAPS: WarMapDefinition[] = [
  {
    id: 'stellar-clash',
    label: 'Stellar Clash',
    image: stellarClashMap,
  },
  {
    id: 'vale-of-clash',
    label: 'Vale of Clash',
    image: valeOfClashMap,
  },
  {
    id: 'fallen-valkyrie',
    label: 'Fallen Valkyrie',
    image: fallenValkyrieMap,
  },
];

const DEFAULT_WAR_MAP_ID =
  WAR_MAPS[0].id;

type WarPhaseId =
  | 'running-lines'
  | 'start'
  | '15-minutes'
  | '10-minutes';

type ToolMode =
  | 'cursor'
  | 'route'
  | 'note'
  | 'area';

type AreaTone =
  | 'danger'
  | 'warning'
  | 'safe';

type NoteTone =
  | 'note'
  | 'danger'
  | 'success';

interface WarPhase {
  id: WarPhaseId;
  label: string;
}

interface MapPoint {
  xPercent: number;
  yPercent: number;
}

interface PartyMarker {
  partyNo: number;
  xPercent: number;
  yPercent: number;
}

interface WarRoute {
  id: string;
  points: MapPoint[];
}

interface WarNote {
  id: string;
  text: string;
  tone: NoteTone;
  xPercent: number;
  yPercent: number;
}

interface WarArea {
  id: string;
  tone: AreaTone;
  centerXPercent: number;
  centerYPercent: number;
  radiusXPercent: number;
  radiusYPercent: number;
}

interface DraftArea {
  startXPercent: number;
  startYPercent: number;
  currentXPercent: number;
  currentYPercent: number;
}

interface DraggedRoutePoint {
  routeId: string;
  pointIndex: number;
}

type PhaseMarkerState = Record<
  WarPhaseId,
  PartyMarker[]
>;

type PhaseRouteState = Record<
  WarPhaseId,
  WarRoute[]
>;

type PhaseNoteState = Record<
  WarPhaseId,
  WarNote[]
>;

type PhaseAreaState = Record<
  WarPhaseId,
  WarArea[]
>;

const DEFAULT_PHASES: WarPhase[] = [
  {
    id: 'running-lines',
    label: 'ไลน์วิ่ง',
  },
  {
    id: 'start',
    label: 'เริ่มวอ',
  },
  {
    id: '15-minutes',
    label: '15 นาที',
  },
  {
    id: '10-minutes',
    label: '10 นาที',
  },
];

const PHASE_ORDER: WarPhaseId[] = [
  'running-lines',
  'start',
  '15-minutes',
  '10-minutes',
];

const INITIAL_MARKERS: PhaseMarkerState = {
  'running-lines': [],
  start: [],
  '15-minutes': [],
  '10-minutes': [],
};

const INITIAL_ROUTES: PhaseRouteState = {
  'running-lines': [],
  start: [],
  '15-minutes': [],
  '10-minutes': [],
};

const INITIAL_NOTES: PhaseNoteState = {
  'running-lines': [],
  start: [],
  '15-minutes': [],
  '10-minutes': [],
};

const INITIAL_AREAS: PhaseAreaState = {
  'running-lines': [],
  start: [],
  '15-minutes': [],
  '10-minutes': [],
};

function createEmptyPlannerData(
  mapId: string,
): WarPlannerData {
  return {
    mapId,
    markersByPhase: {
      'running-lines': [],
      start: [],
      '15-minutes': [],
      '10-minutes': [],
    },
    routesByPhase: {
      'running-lines': [],
      start: [],
      '15-minutes': [],
      '10-minutes': [],
    },
    notesByPhase: {
      'running-lines': [],
      start: [],
      '15-minutes': [],
      '10-minutes': [],
    },
    areasByPhase: {
      'running-lines': [],
      start: [],
      '15-minutes': [],
      '10-minutes': [],
    },
  };
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function createRouteId(): string {
  return [
    'route',
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2, 8),
  ].join('-');
}

function createNoteId(): string {
  return [
    'note',
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2, 8),
  ].join('-');
}

function createAreaId(): string {
  return [
    'area',
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2, 8),
  ].join('-');
}

function getPointDistance(
  firstPoint: MapPoint,
  secondPoint: MapPoint,
): number {
  return Math.hypot(
    firstPoint.xPercent -
      secondPoint.xPercent,
    firstPoint.yPercent -
      secondPoint.yPercent,
  );
}

function buildSmoothRoutePath(
  points: MapPoint[],
): string {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return [
      'M',
      points[0].xPercent,
      points[0].yPercent,
    ].join(' ');
  }

  if (points.length === 2) {
    return [
      'M',
      points[0].xPercent,
      points[0].yPercent,
      'L',
      points[1].xPercent,
      points[1].yPercent,
    ].join(' ');
  }

  const commands = [
    'M',
    points[0].xPercent,
    points[0].yPercent,
  ];

  for (
    let index = 0;
    index < points.length - 1;
    index += 1
  ) {
    const previousPoint =
      points[index - 1] ??
      points[index];

    const currentPoint =
      points[index];

    const nextPoint =
      points[index + 1];

    const followingPoint =
      points[index + 2] ??
      nextPoint;

    const firstControlX =
      currentPoint.xPercent +
      (
        nextPoint.xPercent -
        previousPoint.xPercent
      ) /
        6;

    const firstControlY =
      currentPoint.yPercent +
      (
        nextPoint.yPercent -
        previousPoint.yPercent
      ) /
        6;

    const secondControlX =
      nextPoint.xPercent -
      (
        followingPoint.xPercent -
        currentPoint.xPercent
      ) /
        6;

    const secondControlY =
      nextPoint.yPercent -
      (
        followingPoint.yPercent -
        currentPoint.yPercent
      ) /
        6;

    commands.push(
      'C',
      firstControlX,
      firstControlY,
      secondControlX,
      secondControlY,
      nextPoint.xPercent,
      nextPoint.yPercent,
    );
  }

  return commands.join(' ');
}


function buildRouteArrowHead(
  points: MapPoint[],
): string {
  if (points.length < 2) {
    return '';
  }

  const endPoint =
    points[points.length - 1];

  const previousPoint =
    points[points.length - 2];

  const deltaX =
    endPoint.xPercent -
    previousPoint.xPercent;

  const deltaY =
    endPoint.yPercent -
    previousPoint.yPercent;

  const length =
    Math.hypot(deltaX, deltaY);

  if (length === 0) {
    return '';
  }

  const directionX =
    deltaX / length;

  const directionY =
    deltaY / length;

  const perpendicularX =
    -directionY;

  const perpendicularY =
    directionX;

  const headLength = 2.8;
  const headWidth = 1.7;

  const baseX =
    endPoint.xPercent -
    directionX * headLength;

  const baseY =
    endPoint.yPercent -
    directionY * headLength;

  const leftX =
    baseX +
    perpendicularX * headWidth;

  const leftY =
    baseY +
    perpendicularY * headWidth;

  const rightX =
    baseX -
    perpendicularX * headWidth;

  const rightY =
    baseY -
    perpendicularY * headWidth;

  return [
    'M',
    leftX,
    leftY,
    'L',
    endPoint.xPercent,
    endPoint.yPercent,
    'L',
    rightX,
    rightY,
  ].join(' ');
}

export function WarPlannerPage() {
  const mapRef =
    useRef<HTMLDivElement | null>(null);

  const captureGridRef =
    useRef<HTMLDivElement | null>(null);

  const captureCurrentRef =
    useRef<HTMLElement | null>(null);

  const [
    activeMapId,
    setActiveMapId,
  ] = useState(DEFAULT_WAR_MAP_ID);

  const [
    pendingMapId,
    setPendingMapId,
  ] = useState<string | null>(null);

  const [
    isMapSwitchDialogOpen,
    setIsMapSwitchDialogOpen,
  ] = useState(false);

  const [
    activePhaseId,
    setActivePhaseId,
  ] = useState<WarPhaseId>(
    'running-lines',
  );

  const [
    toolMode,
    setToolMode,
  ] = useState<ToolMode>('cursor');

  const [
    markersByPhase,
    setMarkersByPhase,
  ] = useState<PhaseMarkerState>(
    INITIAL_MARKERS,
  );

  const [
    routesByPhase,
    setRoutesByPhase,
  ] = useState<PhaseRouteState>(
    INITIAL_ROUTES,
  );

  const [
    notesByPhase,
    setNotesByPhase,
  ] = useState<PhaseNoteState>(
    INITIAL_NOTES,
  );

  const [
    areasByPhase,
    setAreasByPhase,
  ] = useState<PhaseAreaState>(
    INITIAL_AREAS,
  );

  const [
    areaTone,
    setAreaTone,
  ] = useState<AreaTone>('danger');

  const [
    draftArea,
    setDraftArea,
  ] = useState<DraftArea | null>(null);

  const [
    selectedAreaId,
    setSelectedAreaId,
  ] = useState<string | null>(null);

  const [
    draggingAreaId,
    setDraggingAreaId,
  ] = useState<string | null>(null);

  const [
    resizingAreaId,
    setResizingAreaId,
  ] = useState<string | null>(null);

  const [
    draggingPartyNo,
    setDraggingPartyNo,
  ] = useState<number | null>(null);

  const [
    draftRoutePoints,
    setDraftRoutePoints,
  ] = useState<MapPoint[]>([]);

  const [
    previewRoutePoint,
    setPreviewRoutePoint,
  ] = useState<MapPoint | null>(null);

  const [
    selectedRouteId,
    setSelectedRouteId,
  ] = useState<string | null>(null);

  const [
    selectedNoteId,
    setSelectedNoteId,
  ] = useState<string | null>(null);

  const [
    selectedPartyNo,
    setSelectedPartyNo,
  ] = useState<number | null>(null);

  const [
    draggedRoutePoint,
    setDraggedRoutePoint,
  ] = useState<DraggedRoutePoint | null>(
    null,
  );

  const [
    draggingNoteId,
    setDraggingNoteId,
  ] = useState<string | null>(null);

  const [
    pendingNotePosition,
    setPendingNotePosition,
  ] = useState<MapPoint | null>(null);

  const [
    noteDraftText,
    setNoteDraftText,
  ] = useState('');

  const [
    noteDraftTone,
    setNoteDraftTone,
  ] = useState<NoteTone>('note');

  const [
    isCapturing,
    setIsCapturing,
  ] = useState(false);

  const [
    captureMode,
    setCaptureMode,
  ] = useState<
    'current' | 'all' | null
  >(null);

  const [
    captureMessage,
    setCaptureMessage,
  ] = useState('');

  const [
    isClearDialogOpen,
    setIsClearDialogOpen,
  ] = useState(false);


  const [
    isLoadingPlan,
    setIsLoadingPlan,
  ] = useState(true);

  const [
    isSavingPlan,
    setIsSavingPlan,
  ] = useState(false);

  const [
    savedPlanSignature,
    setSavedPlanSignature,
  ] = useState<string | null>(null);

  const [
    planMessage,
    setPlanMessage,
  ] = useState('');

  const [
    planErrorMessage,
    setPlanErrorMessage,
  ] = useState('');

  const {
    parties,
    isLoading,
    errorMessage,
    reloadParties,
  } = useParties('guildLeague');

  const warParties = useMemo(
    () =>
      parties
        .slice(0, 8)
        .map((party, index) => ({
          ...party,
          displayPartyNo: index + 1,
        })),
    [parties],
  );

  const currentMarkers =
    markersByPhase[activePhaseId];

  const currentRoutes =
    routesByPhase[activePhaseId];

  const currentNotes =
    notesByPhase[activePhaseId];

  const currentAreas =
    areasByPhase[activePhaseId];

  const plannerData = useMemo<WarPlannerData>(
    () => ({
      mapId: activeMapId,
      markersByPhase,
      routesByPhase,
      notesByPhase,
      areasByPhase,
    }),
    [
      activeMapId,
      areasByPhase,
      markersByPhase,
      notesByPhase,
      routesByPhase,
    ],
  );

  const currentPlanSignature = useMemo(
    () => JSON.stringify(plannerData),
    [plannerData],
  );

  const isPlanDirty =
    savedPlanSignature !== null &&
    currentPlanSignature !== savedPlanSignature;

  const currentMap =
    WAR_MAPS.find(
      (map) => map.id === activeMapId,
    ) ?? WAR_MAPS[0];

  const selectedRoute =
    currentRoutes.find(
      (route) =>
        route.id === selectedRouteId,
    ) ?? null;

  const placedPartyNumbers = useMemo(
    () =>
      new Set(
        currentMarkers.map(
          (marker) => marker.partyNo,
        ),
      ),
    [currentMarkers],
  );

  const visibleDraftPoints =
    previewRoutePoint &&
    draftRoutePoints.length > 0
      ? [
          ...draftRoutePoints,
          previewRoutePoint,
        ]
      : draftRoutePoints;

  useEffect(() => {
    let isCancelled = false;

    async function loadSavedPlan(): Promise<void> {
      try {
        setIsLoadingPlan(true);
        setSavedPlanSignature(null);
        setPlanErrorMessage('');
        setPlanMessage('');
        resetRouteInteraction();

        const savedPlan = await getWarPlanner(
          activeMapId,
        );

        if (isCancelled) {
          return;
        }

        const loadedPlan =
          savedPlan ??
          createEmptyPlannerData(activeMapId);

        setMarkersByPhase(
          loadedPlan.markersByPhase,
        );
        setRoutesByPhase(
          loadedPlan.routesByPhase,
        );
        setNotesByPhase(
          loadedPlan.notesByPhase,
        );
        setAreasByPhase(
          loadedPlan.areasByPhase,
        );
        setActivePhaseId('running-lines');
        setToolMode('cursor');
        setSavedPlanSignature(
          JSON.stringify(loadedPlan),
        );

        if (savedPlan) {
          setPlanMessage(
            `โหลดแผน “${currentMap.label}” แล้ว`,
          );
        }
      } catch (error) {
        if (!isCancelled) {
          const emptyPlan =
            createEmptyPlannerData(activeMapId);

          setMarkersByPhase(
            emptyPlan.markersByPhase,
          );
          setRoutesByPhase(
            emptyPlan.routesByPhase,
          );
          setNotesByPhase(
            emptyPlan.notesByPhase,
          );
          setAreasByPhase(
            emptyPlan.areasByPhase,
          );
          setSavedPlanSignature(
            JSON.stringify(emptyPlan),
          );
          setPlanErrorMessage(
            error instanceof Error
              ? error.message
              : 'โหลด War Planner ไม่สำเร็จ',
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPlan(false);
        }
      }
    }

    void loadSavedPlan();

    return () => {
      isCancelled = true;
    };
  }, [activeMapId]);

  async function handleSavePlan(): Promise<void> {
    if (isLoadingPlan || isSavingPlan) {
      return;
    }

    try {
      setIsSavingPlan(true);
      setPlanErrorMessage('');
      setPlanMessage('');

      const message = await saveWarPlanner(
        plannerData,
      );

      setSavedPlanSignature(
        JSON.stringify(plannerData),
      );
      setPlanMessage(message);

      window.setTimeout(() => {
        setPlanMessage('');
      }, 3000);
    } catch (error) {
      setPlanErrorMessage(
        error instanceof Error
          ? error.message
          : 'บันทึก War Planner ไม่สำเร็จ',
      );
    } finally {
      setIsSavingPlan(false);
    }
  }

  function requestMapChange(
    nextMapId: string,
  ): void {
    if (
      nextMapId === activeMapId ||
      isLoadingPlan ||
      isSavingPlan
    ) {
      return;
    }

    if (isPlanDirty) {
      setPendingMapId(nextMapId);
      setIsMapSwitchDialogOpen(true);
      return;
    }

    setActiveMapId(nextMapId);
  }

  function closeMapSwitchDialog(): void {
    setPendingMapId(null);
    setIsMapSwitchDialogOpen(false);
  }

  function confirmMapSwitch(): void {
    if (!pendingMapId) {
      return;
    }

    setActiveMapId(pendingMapId);
    setPendingMapId(null);
    setIsMapSwitchDialogOpen(false);
  }

  function getMapPosition(
    clientX: number,
    clientY: number,
  ): MapPoint | null {
    const mapElement =
      mapRef.current;

    if (!mapElement) {
      return null;
    }

    const mapRect =
      mapElement.getBoundingClientRect();

    if (
      mapRect.width <= 0 ||
      mapRect.height <= 0
    ) {
      return null;
    }

    return {
      xPercent: clamp(
        ((clientX - mapRect.left) /
          mapRect.width) *
          100,
        0,
        100,
      ),

      yPercent: clamp(
        ((clientY - mapRect.top) /
          mapRect.height) *
          100,
        0,
        100,
      ),
    };
  }

  function resetRouteInteraction(): void {
    setDraftRoutePoints([]);
    setPreviewRoutePoint(null);
    setSelectedRouteId(null);
    setSelectedNoteId(null);
    setSelectedPartyNo(null);
    setDraggedRoutePoint(null);
    setDraggingNoteId(null);
    setSelectedAreaId(null);
    setDraggingAreaId(null);
    setResizingAreaId(null);
    setDraftArea(null);
    setPendingNotePosition(null);
    setNoteDraftText('');
    setNoteDraftTone('note');
  }

  function handlePhaseChange(
    phaseId: WarPhaseId,
  ): void {
    setActivePhaseId(phaseId);
    setDraggingPartyNo(null);
    resetRouteInteraction();
  }

  function handleToolChange(
    nextToolMode: ToolMode,
  ): void {
    setToolMode(nextToolMode);
    setDraggingPartyNo(null);
    resetRouteInteraction();
  }

  function placePartyOnMap(
    partyNo: number,
  ): void {
    if (
      placedPartyNumbers.has(partyNo)
    ) {
      return;
    }

    const offsetIndex =
      currentMarkers.length;

    const column =
      offsetIndex % 4;

    const row =
      Math.floor(
        offsetIndex / 4,
      );

    setMarkersByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]: [
          ...currentState[
            activePhaseId
          ],

          {
            partyNo,
            xPercent:
              38 + column * 8,
            yPercent:
              43 + row * 10,
          },
        ],
      }),
    );
  }

  function updateMarkerPosition(
    partyNo: number,
    clientX: number,
    clientY: number,
  ): void {
    const position =
      getMapPosition(
        clientX,
        clientY,
      );

    if (!position) {
      return;
    }

    setMarkersByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].map((marker) =>
            marker.partyNo ===
            partyNo
              ? {
                  ...marker,

                  xPercent: clamp(
                    position.xPercent,
                    3,
                    97,
                  ),

                  yPercent: clamp(
                    position.yPercent,
                    4,
                    96,
                  ),
                }
              : marker,
          ),
      }),
    );
  }

  function handleMarkerPointerDown(
    event:
      ReactPointerEvent<HTMLButtonElement>,
    partyNo: number,
  ): void {
    if (
      toolMode !== 'cursor' ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setSelectedRouteId(null);
    setSelectedNoteId(null);
    setSelectedPartyNo(partyNo);
    setDraggingPartyNo(partyNo);

    updateMarkerPosition(
      partyNo,
      event.clientX,
      event.clientY,
    );
  }

  function handleMarkerPointerMove(
    event:
      ReactPointerEvent<HTMLButtonElement>,
    partyNo: number,
  ): void {
    if (
      toolMode !== 'cursor' ||
      draggingPartyNo !== partyNo
    ) {
      return;
    }

    updateMarkerPosition(
      partyNo,
      event.clientX,
      event.clientY,
    );
  }

  function handleMarkerPointerUp(
    event:
      ReactPointerEvent<HTMLButtonElement>,
  ): void {
    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    setDraggingPartyNo(null);
  }

  function addDraftRoutePoint(
    position: MapPoint,
  ): void {
    setDraftRoutePoints(
      (currentPoints) => {
        const previousPoint =
          currentPoints[
            currentPoints.length - 1
          ];

        if (
          previousPoint &&
          getPointDistance(
            previousPoint,
            position,
          ) < 0.8
        ) {
          return currentPoints;
        }

        return [
          ...currentPoints,
          position,
        ];
      },
    );

    setPreviewRoutePoint(null);
  }

  function handleRouteCanvasClick(
    event:
      ReactMouseEvent<SVGSVGElement>,
  ): void {
    if (toolMode !== 'route') {
      return;
    }

    const position =
      getMapPosition(
        event.clientX,
        event.clientY,
      );

    if (!position) {
      return;
    }

    addDraftRoutePoint(position);
  }

  function handleRouteCanvasDoubleClick(
    event:
      ReactMouseEvent<SVGSVGElement>,
  ): void {
    if (toolMode !== 'route') {
      return;
    }

    event.preventDefault();

    finishDraftRoute();
  }

  function handleRouteCanvasPointerMove(
    event:
      ReactPointerEvent<SVGSVGElement>,
  ): void {
    if (
      toolMode !== 'route' ||
      draftRoutePoints.length === 0
    ) {
      return;
    }

    const position =
      getMapPosition(
        event.clientX,
        event.clientY,
      );

    if (position) {
      setPreviewRoutePoint(
        position,
      );
    }
  }

  function handleRouteCanvasPointerLeave(): void {
    setPreviewRoutePoint(null);
  }

  function finishDraftRoute(): void {
    if (
      draftRoutePoints.length < 2
    ) {
      return;
    }

    const newRoute: WarRoute = {
      id: createRouteId(),

      points:
        draftRoutePoints.map(
          (point) => ({
            ...point,
          }),
        ),
    };

    setRoutesByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]: [
          ...currentState[
            activePhaseId
          ],

          newRoute,
        ],
      }),
    );

    setDraftRoutePoints([]);
    setPreviewRoutePoint(null);
    setSelectedRouteId(
      newRoute.id,
    );
    setToolMode('cursor');
  }

  function cancelDraftRoute(): void {
    setDraftRoutePoints([]);
    setPreviewRoutePoint(null);
  }

  function handleRouteSelect(
    event:
      ReactPointerEvent<SVGPathElement>,
    routeId: string,
  ): void {
    if (
      toolMode !== 'cursor' ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setSelectedRouteId(routeId);
    setSelectedNoteId(null);
    setSelectedPartyNo(null);
  }

  function handleRouteContextMenu(
    event:
      ReactMouseEvent<SVGPathElement>,
    routeId: string,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    setRoutesByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].filter(
            (route) =>
              route.id !== routeId,
          ),
      }),
    );

    if (
      selectedRouteId === routeId
    ) {
      setSelectedRouteId(null);
    }
  }

  function updateRoutePoint(
    routeId: string,
    pointIndex: number,
    clientX: number,
    clientY: number,
  ): void {
    const position =
      getMapPosition(
        clientX,
        clientY,
      );

    if (!position) {
      return;
    }

    setRoutesByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].map((route) => {
            if (
              route.id !== routeId
            ) {
              return route;
            }

            return {
              ...route,

              points:
                route.points.map(
                  (
                    point,
                    currentIndex,
                  ) =>
                    currentIndex ===
                    pointIndex
                      ? position
                      : point,
                ),
            };
          }),
      }),
    );
  }

  function handleRoutePointPointerDown(
    event:
      ReactPointerEvent<SVGCircleElement>,
    routeId: string,
    pointIndex: number,
  ): void {
    if (toolMode !== 'cursor') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setSelectedRouteId(routeId);
    setSelectedNoteId(null);
    setSelectedPartyNo(null);

    setDraggedRoutePoint({
      routeId,
      pointIndex,
    });
  }

  function handleRoutePointPointerMove(
    event:
      ReactPointerEvent<SVGCircleElement>,
  ): void {
    if (
      toolMode !== 'cursor' ||
      !draggedRoutePoint
    ) {
      return;
    }

    updateRoutePoint(
      draggedRoutePoint.routeId,
      draggedRoutePoint.pointIndex,
      event.clientX,
      event.clientY,
    );
  }

  function handleRoutePointPointerUp(
    event:
      ReactPointerEvent<SVGCircleElement>,
  ): void {
    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    setDraggedRoutePoint(null);
  }

  function handleAreaCanvasPointerDown(
    event:
      ReactPointerEvent<HTMLDivElement>,
  ): void {
    if (
      toolMode !== 'area' ||
      event.button !== 0
    ) {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        '.war-planner-map-area',
      )
    ) {
      return;
    }

    const position =
      getMapPosition(
        event.clientX,
        event.clientY,
      );

    if (!position) {
      return;
    }

    event.preventDefault();

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setDraftArea({
      startXPercent:
        position.xPercent,
      startYPercent:
        position.yPercent,
      currentXPercent:
        position.xPercent,
      currentYPercent:
        position.yPercent,
    });
  }

  function handleAreaCanvasPointerMove(
    event:
      ReactPointerEvent<HTMLDivElement>,
  ): void {
    if (
      toolMode !== 'area' ||
      !draftArea
    ) {
      return;
    }

    const position =
      getMapPosition(
        event.clientX,
        event.clientY,
      );

    if (!position) {
      return;
    }

    setDraftArea(
      (currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              currentXPercent:
                position.xPercent,
              currentYPercent:
                position.yPercent,
            }
          : null,
    );
  }

  function handleAreaCanvasPointerUp(
    event:
      ReactPointerEvent<HTMLDivElement>,
  ): void {
    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    if (!draftArea) {
      return;
    }

    const radiusXPercent =
      Math.abs(
        draftArea.currentXPercent -
        draftArea.startXPercent,
      ) / 2;

    const radiusYPercent =
      Math.abs(
        draftArea.currentYPercent -
        draftArea.startYPercent,
      ) / 2;

    if (
      radiusXPercent >= 1.5 &&
      radiusYPercent >= 1.5
    ) {
      const newArea: WarArea = {
        id: createAreaId(),
        tone: areaTone,

        centerXPercent:
          (
            draftArea.startXPercent +
            draftArea.currentXPercent
          ) / 2,

        centerYPercent:
          (
            draftArea.startYPercent +
            draftArea.currentYPercent
          ) / 2,

        radiusXPercent,
        radiusYPercent,
      };

      setAreasByPhase(
        (currentState) => ({
          ...currentState,

          [activePhaseId]: [
            ...currentState[
              activePhaseId
            ],

            newArea,
          ],
        }),
      );

      setSelectedAreaId(
        newArea.id,
      );

      setSelectedRouteId(null);
      setSelectedNoteId(null);
      setSelectedPartyNo(null);
      setToolMode('cursor');
    }

    setDraftArea(null);
  }

  function updateAreaCenter(
    areaId: string,
    clientX: number,
    clientY: number,
  ): void {
    const position =
      getMapPosition(
        clientX,
        clientY,
      );

    if (!position) {
      return;
    }

    setAreasByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].map((area) =>
            area.id === areaId
              ? {
                  ...area,

                  centerXPercent:
                    clamp(
                      position.xPercent,
                      area.radiusXPercent,
                      100 -
                        area.radiusXPercent,
                    ),

                  centerYPercent:
                    clamp(
                      position.yPercent,
                      area.radiusYPercent,
                      100 -
                        area.radiusYPercent,
                    ),
                }
              : area,
          ),
      }),
    );
  }

  function handleAreaPointerDown(
    event:
      ReactPointerEvent<HTMLDivElement>,
    areaId: string,
  ): void {
    if (
      toolMode !== 'cursor' ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setSelectedAreaId(areaId);
    setSelectedRouteId(null);
    setSelectedNoteId(null);
    setSelectedPartyNo(null);
    setDraggingAreaId(areaId);
  }

  function handleAreaPointerMove(
    event:
      ReactPointerEvent<HTMLDivElement>,
    areaId: string,
  ): void {
    if (
      toolMode !== 'cursor' ||
      draggingAreaId !== areaId
    ) {
      return;
    }

    updateAreaCenter(
      areaId,
      event.clientX,
      event.clientY,
    );
  }

  function handleAreaPointerUp(
    event:
      ReactPointerEvent<HTMLDivElement>,
  ): void {
    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    setDraggingAreaId(null);
  }

  function handleAreaResizePointerDown(
    event:
      ReactPointerEvent<HTMLSpanElement>,
    areaId: string,
  ): void {
    if (
      toolMode !== 'cursor' ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setSelectedAreaId(areaId);
    setResizingAreaId(areaId);
  }

  function handleAreaResizePointerMove(
    event:
      ReactPointerEvent<HTMLSpanElement>,
    areaId: string,
  ): void {
    if (
      toolMode !== 'cursor' ||
      resizingAreaId !== areaId
    ) {
      return;
    }

    const position =
      getMapPosition(
        event.clientX,
        event.clientY,
      );

    if (!position) {
      return;
    }

    setAreasByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].map((area) =>
            area.id === areaId
              ? {
                  ...area,

                  radiusXPercent:
                    clamp(
                      Math.abs(
                        position.xPercent -
                        area.centerXPercent,
                      ),
                      2,
                      48,
                    ),

                  radiusYPercent:
                    clamp(
                      Math.abs(
                        position.yPercent -
                        area.centerYPercent,
                      ),
                      2,
                      48,
                    ),
                }
              : area,
          ),
      }),
    );
  }

  function handleAreaResizePointerUp(
    event:
      ReactPointerEvent<HTMLSpanElement>,
  ): void {
    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    setResizingAreaId(null);
  }

  function handleAreaContextMenu(
    event:
      ReactMouseEvent<HTMLDivElement>,
    areaId: string,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    setAreasByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].filter(
            (area) =>
              area.id !== areaId,
          ),
      }),
    );

    if (
      selectedAreaId === areaId
    ) {
      setSelectedAreaId(null);
    }
  }

  function handleMapNoteClick(
    event:
      ReactMouseEvent<HTMLDivElement>,
  ): void {
    if (toolMode !== 'note') {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        '.war-planner-map-note',
      )
    ) {
      return;
    }

    const position =
      getMapPosition(
        event.clientX,
        event.clientY,
      );

    if (!position) {
      return;
    }

    setPendingNotePosition(
      position,
    );

    setNoteDraftText('');
    setNoteDraftTone('note');
  }

  function closeNoteDialog(): void {
    setPendingNotePosition(null);
    setNoteDraftText('');
    setNoteDraftTone('note');
  }

  function submitNote(
    event:
      ReactFormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    if (
      !pendingNotePosition ||
      noteDraftText.trim() === ''
    ) {
      return;
    }

    const newNote: WarNote = {
      id: createNoteId(),
      text: noteDraftText.trim(),
      tone: noteDraftTone,
      xPercent:
        pendingNotePosition.xPercent,
      yPercent:
        pendingNotePosition.yPercent,
    };

    setNotesByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]: [
          ...currentState[
            activePhaseId
          ],

          newNote,
        ],
      }),
    );

    closeNoteDialog();
    setToolMode('cursor');
  }

  function updateNotePosition(
    noteId: string,
    clientX: number,
    clientY: number,
  ): void {
    const position =
      getMapPosition(
        clientX,
        clientY,
      );

    if (!position) {
      return;
    }

    setNotesByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].map((note) =>
            note.id === noteId
              ? {
                  ...note,

                  xPercent: clamp(
                    position.xPercent,
                    2,
                    98,
                  ),

                  yPercent: clamp(
                    position.yPercent,
                    3,
                    97,
                  ),
                }
              : note,
          ),
      }),
    );
  }

  function handleNotePointerDown(
    event:
      ReactPointerEvent<HTMLButtonElement>,
    noteId: string,
  ): void {
    if (
      toolMode !== 'cursor' ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setSelectedRouteId(null);
    setSelectedNoteId(noteId);
    setSelectedPartyNo(null);
    setDraggingNoteId(noteId);

    updateNotePosition(
      noteId,
      event.clientX,
      event.clientY,
    );
  }

  function handleNotePointerMove(
    event:
      ReactPointerEvent<HTMLButtonElement>,
    noteId: string,
  ): void {
    if (
      toolMode !== 'cursor' ||
      draggingNoteId !== noteId
    ) {
      return;
    }

    updateNotePosition(
      noteId,
      event.clientX,
      event.clientY,
    );
  }

  function handleNotePointerUp(
    event:
      ReactPointerEvent<HTMLButtonElement>,
  ): void {
    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    setDraggingNoteId(null);
  }

  function handleNoteContextMenu(
    event:
      ReactMouseEvent<HTMLButtonElement>,
    noteId: string,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    setNotesByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].filter(
            (note) =>
              note.id !== noteId,
          ),
      }),
    );

    if (
      selectedNoteId === noteId
    ) {
      setSelectedNoteId(null);
    }
  }

  function handleMarkerContextMenu(
    event:
      ReactMouseEvent<HTMLButtonElement>,
    partyNo: number,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    setMarkersByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].filter(
            (marker) =>
              marker.partyNo !==
              partyNo,
          ),
      }),
    );

    if (
      selectedPartyNo === partyNo
    ) {
      setSelectedPartyNo(null);
    }
  }

  function deleteSelectedRoute(): void {
    if (!selectedRouteId) {
      return;
    }

    setRoutesByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]:
          currentState[
            activePhaseId
          ].filter(
            (route) =>
              route.id !==
              selectedRouteId,
          ),
      }),
    );

    setSelectedRouteId(null);
  }

  function openClearPhaseDialog(): void {
    setIsClearDialogOpen(true);
  }

  function closeClearPhaseDialog(): void {
    setIsClearDialogOpen(false);
  }

  function confirmClearCurrentPhase(): void {
    setMarkersByPhase(
      (currentState) => ({
        ...currentState,
        [activePhaseId]: [],
      }),
    );

    setRoutesByPhase(
      (currentState) => ({
        ...currentState,
        [activePhaseId]: [],
      }),
    );

    setNotesByPhase(
      (currentState) => ({
        ...currentState,
        [activePhaseId]: [],
      }),
    );

    setAreasByPhase(
      (currentState) => ({
        ...currentState,
        [activePhaseId]: [],
      }),
    );

    setToolMode('cursor');
    setDraggingPartyNo(null);
    resetRouteInteraction();
    setIsClearDialogOpen(false);
  }

  function clonePlanToNextPhase(): void {
    const currentPhaseIndex =
      PHASE_ORDER.indexOf(
        activePhaseId,
      );

    const nextPhaseId =
      PHASE_ORDER[
        currentPhaseIndex + 1
      ];

    if (!nextPhaseId) {
      return;
    }

    const targetMarkers =
      markersByPhase[nextPhaseId];

    const targetRoutes =
      routesByPhase[nextPhaseId];

    const targetNotes =
      notesByPhase[nextPhaseId];

    const targetAreas =
      areasByPhase[nextPhaseId];

    const targetHasData =
      targetMarkers.length > 0 ||
      targetRoutes.length > 0 ||
      targetNotes.length > 0 ||
      targetAreas.length > 0;

    if (targetHasData) {
      const targetLabel =
        DEFAULT_PHASES.find(
          (phase) =>
            phase.id ===
            nextPhaseId,
        )?.label ?? nextPhaseId;

      const confirmed =
        window.confirm(
          [
            `ช่วง "${targetLabel}" มีแผนอยู่แล้ว`,
            '',
            'ต้องการเขียนทับด้วยแผนจากช่วงปัจจุบันหรือไม่?',
          ].join('\n'),
        );

      if (!confirmed) {
        return;
      }
    }

    const clonedMarkers =
      markersByPhase[
        activePhaseId
      ].map((marker) => ({
        ...marker,
      }));

    const clonedRoutes =
      routesByPhase[
        activePhaseId
      ].map((route) => ({
        ...route,

        id: createRouteId(),

        points:
          route.points.map(
            (point) => ({
              ...point,
            }),
          ),
      }));

    const clonedNotes =
      notesByPhase[
        activePhaseId
      ].map((note) => ({
        ...note,
        id: createNoteId(),
      }));

    const clonedAreas =
      areasByPhase[
        activePhaseId
      ].map((area) => ({
        ...area,
        id: createAreaId(),
      }));

    setMarkersByPhase(
      (currentState) => ({
        ...currentState,

        [nextPhaseId]:
          clonedMarkers,
      }),
    );

    setRoutesByPhase(
      (currentState) => ({
        ...currentState,

        [nextPhaseId]:
          clonedRoutes,
      }),
    );

    setNotesByPhase(
      (currentState) => ({
        ...currentState,

        [nextPhaseId]:
          clonedNotes,
      }),
    );

    setAreasByPhase(
      (currentState) => ({
        ...currentState,

        [nextPhaseId]:
          clonedAreas,
      }),
    );

    setActivePhaseId(
      nextPhaseId,
    );

    setToolMode('cursor');
    setDraggingPartyNo(null);
    resetRouteInteraction();
  }

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      if (
        event.key !== 'Delete' &&
        event.key !== 'Backspace'
      ) {
        return;
      }

      const target =
        event.target as HTMLElement | null;

      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (selectedRouteId) {
        event.preventDefault();

        setRoutesByPhase(
          (currentState) => ({
            ...currentState,

            [activePhaseId]:
              currentState[
                activePhaseId
              ].filter(
                (route) =>
                  route.id !==
                  selectedRouteId,
              ),
          }),
        );

        setSelectedRouteId(null);
        return;
      }

      if (selectedNoteId) {
        event.preventDefault();

        setNotesByPhase(
          (currentState) => ({
            ...currentState,

            [activePhaseId]:
              currentState[
                activePhaseId
              ].filter(
                (note) =>
                  note.id !==
                  selectedNoteId,
              ),
          }),
        );

        setSelectedNoteId(null);
        return;
      }

      if (selectedAreaId) {
        event.preventDefault();

        setAreasByPhase(
          (currentState) => ({
            ...currentState,

            [activePhaseId]:
              currentState[
                activePhaseId
              ].filter(
                (area) =>
                  area.id !==
                  selectedAreaId,
              ),
          }),
        );

        setSelectedAreaId(null);
        return;
      }

      if (selectedPartyNo !== null) {
        event.preventDefault();

        setMarkersByPhase(
          (currentState) => ({
            ...currentState,

            [activePhaseId]:
              currentState[
                activePhaseId
              ].filter(
                (marker) =>
                  marker.partyNo !==
                  selectedPartyNo,
              ),
          }),
        );

        setSelectedPartyNo(null);
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    activePhaseId,
    selectedAreaId,
    selectedNoteId,
    selectedPartyNo,
    selectedRouteId,
  ]);

  async function createCaptureImage(
    captureElement: HTMLElement,
    fileName: string,
    backgroundColor: string,
    forcedWidth?: number,
  ): Promise<void> {
    const blob = await toBlob(
      captureElement,
      {
        backgroundColor,
        pixelRatio: 1.5,
        cacheBust: true,
        width:
          forcedWidth ??
          captureElement.scrollWidth,
        height:
          captureElement.scrollHeight,
      },
    );

    if (!blob) {
      throw new Error(
        'สร้างภาพไม่สำเร็จ',
      );
    }

    const pngBlob =
      blob.type === 'image/png'
        ? blob
        : new Blob([blob], {
            type: 'image/png',
          });

    if (
      navigator.clipboard &&
      typeof ClipboardItem !==
        'undefined'
    ) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob,
        }),
      ]);

      setCaptureMessage(
        '✓ คัดลอกภาพแล้ว',
      );
    } else {
      const downloadUrl =
        URL.createObjectURL(
          pngBlob,
        );

      const downloadLink =
        document.createElement('a');

      downloadLink.href =
        downloadUrl;

      downloadLink.download =
        fileName;

      downloadLink.click();

      URL.revokeObjectURL(
        downloadUrl,
      );

      setCaptureMessage(
        '✓ ดาวน์โหลดภาพแล้ว',
      );
    }

    window.setTimeout(() => {
      setCaptureMessage('');
    }, 2500);
  }

  async function handleCaptureCurrentPhase(): Promise<void> {
    const captureElement =
      captureCurrentRef.current;

    if (!captureElement) {
      return;
    }

    const phaseLabel =
      DEFAULT_PHASES.find(
        (phase) =>
          phase.id ===
          activePhaseId,
      )?.label ?? activePhaseId;

    try {
      setIsCapturing(true);
      setCaptureMode('current');
      setCaptureMessage('');

      await createCaptureImage(
        captureElement,
        `war-planner-${activeMapId}-${phaseLabel}.png`,
        '#ffffff',
        880,
      );
    } catch (error) {
      console.error(
        'ไม่สามารถสร้างภาพช่วงปัจจุบันได้',
        error,
      );

      setCaptureMessage(
        'สร้างภาพไม่สำเร็จ',
      );
    } finally {
      setIsCapturing(false);
      setCaptureMode(null);
    }
  }

  async function handleCaptureAllPhases(): Promise<void> {
    const captureElement =
      captureGridRef.current;

    if (!captureElement) {
      return;
    }

    try {
      setIsCapturing(true);
      setCaptureMode('all');
      setCaptureMessage('');

      await createCaptureImage(
        captureElement,
        `war-planner-${activeMapId}-all-phases.png`,
        '#e2e8f0',
        1800,
      );
    } catch (error) {
      console.error(
        'ไม่สามารถสร้างภาพ War Planner ได้',
        error,
      );

      setCaptureMessage(
        'สร้างภาพไม่สำเร็จ',
      );
    } finally {
      setIsCapturing(false);
      setCaptureMode(null);
    }
  }

  const activePhaseIndex =
    PHASE_ORDER.indexOf(
      activePhaseId,
    );

  const nextPhaseId =
    PHASE_ORDER[
      activePhaseIndex + 1
    ];

  const nextPhaseLabel =
    DEFAULT_PHASES.find(
      (phase) =>
        phase.id ===
        nextPhaseId,
    )?.label;

  const activePhaseLabel =
    DEFAULT_PHASES.find(
      (phase) =>
        phase.id ===
        activePhaseId,
    )?.label ?? activePhaseId;

  return (
    <main className="war-planner-page">
      <section className="war-planner-toolbar">
        <div>
          <h2>War Planner</h2>

          <p>
            วางตำแหน่งปาร์ตี้และแผนการเล่นตามช่วงเวลา
            {' • '}
            {currentMap.label}
          </p>
        </div>

        <div className="war-planner-toolbar-actions">
          <button
            type="button"
            className="war-planner-clear-button"
            onClick={
              openClearPhaseDialog
            }
          >
            🗑 ล้าง Phase นี้
          </button>

          <button
            type="button"
            className="war-planner-capture-button current"
            onClick={() =>
              void handleCaptureCurrentPhase()
            }
            disabled={isCapturing}
          >
            {captureMode === 'current'
              ? 'กำลังสร้างภาพ...'
              : captureMessage &&
                  captureMode === null
                ? captureMessage
                : '📷 แคปช่วงนี้'}
          </button>

          <button
            type="button"
            className="war-planner-capture-button all"
            onClick={() =>
              void handleCaptureAllPhases()
            }
            disabled={isCapturing}
          >
            {captureMode === 'all'
              ? 'กำลังสร้างภาพ...'
              : '📷 แคป 4 ช่วง'}
          </button>

          <button
            type="button"
            className="war-planner-save-button"
            onClick={() =>
              void handleSavePlan()
            }
            disabled={
              isLoadingPlan ||
              isSavingPlan ||
              !isPlanDirty
            }
          >
            {isLoadingPlan
              ? 'กำลังโหลด...'
              : isSavingPlan
                ? 'กำลังบันทึก...'
                : isPlanDirty
                  ? 'บันทึก*'
                  : 'บันทึกแล้ว'}
          </button>
        </div>
      </section>

      {planMessage && (
        <div className="war-planner-save-message">
          ✓ {planMessage}
        </div>
      )}

      {planErrorMessage && (
        <div className="war-planner-save-error">
          ⚠ {planErrorMessage}
        </div>
      )}

      <section className="war-planner-map-tabs">
        <div className="war-planner-map-tabs-header">
          <div>
            <span className="war-planner-map-tabs-eyebrow">
              MAPS
            </span>

            <h3>เลือกแผนที่วอ</h3>
          </div>

          <p>
            แผนของแต่ละแมพถูกบันทึกแยกกัน
          </p>
        </div>

        <div
          className="war-planner-map-tabs-list"
          role="tablist"
          aria-label="เลือกแผนที่วอ"
        >
          {WAR_MAPS.map((map, index) => {
            const isActive =
              map.id === activeMapId;

            return (
              <button
                key={map.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={[
                  'war-planner-map-tab',
                  isActive ? 'active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  requestMapChange(map.id)
                }
                disabled={
                  isLoadingPlan ||
                  isSavingPlan
                }
              >
                <span
                  className="war-planner-map-tab-icon"
                  aria-hidden="true"
                >
                  {index === 0 ? '🏰' : '🗺️'}
                </span>

                <span className="war-planner-map-tab-content">
                  <strong>{map.label}</strong>

                  <small>
                    {isActive
                      ? 'กำลังใช้งาน'
                      : 'คลิกเพื่อเปิดแผน'}
                  </small>
                </span>

                <span
                  className="war-planner-map-tab-status"
                  aria-hidden="true"
                >
                  {isActive ? '✓' : '›'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <nav className="war-planner-timeline">
        {DEFAULT_PHASES.map(
          (phase) => (
            <button
              key={phase.id}
              type="button"
              className={
                activePhaseId ===
                phase.id
                  ? 'active'
                  : ''
              }
              onClick={() =>
                handlePhaseChange(
                  phase.id,
                )
              }
            >
              {phase.label}
            </button>
          ),
        )}

        <button
          type="button"
          className="war-planner-clone-phase"
          onClick={
            clonePlanToNextPhase
          }
          disabled={!nextPhaseId}
          title={
            nextPhaseLabel
              ? `คัดลอกแผนไป ${nextPhaseLabel}`
              : 'ไม่มีช่วงถัดไป'
          }
        >
          {nextPhaseLabel
            ? `คัดลอกไป ${nextPhaseLabel}`
            : 'ถึงช่วงสุดท้ายแล้ว'}
        </button>
      </nav>

      <section className="war-planner-workspace">
        <aside className="war-planner-sidebar">
          <header>
            <h3>Party List</h3>

            <p>
              กดปาร์ตี้เพื่อวางลงบนแผนที่
            </p>
          </header>

          {isLoading && (
            <div className="war-planner-sidebar-status">
              กำลังโหลดปาร์ตี้...
            </div>
          )}

          {!isLoading &&
            errorMessage && (
              <div className="war-planner-sidebar-error">
                <p>
                  {errorMessage}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void reloadParties()
                  }
                >
                  ลองใหม่
                </button>
              </div>
            )}

          {!isLoading &&
            !errorMessage && (
              <div className="war-planner-party-list">
                {warParties.length ===
                0 ? (
                  <div className="war-planner-sidebar-status">
                    ยังไม่มีข้อมูลปาร์ตี้
                  </div>
                ) : (
                  warParties.map(
                    (party) => {
                      const partyNo =
                        party.displayPartyNo;

                      const isPlaced =
                        placedPartyNumbers.has(
                          partyNo,
                        );

                      return (
                        <button
                          key={partyNo}
                          type="button"
                          className={[
                            'war-planner-party-card',

                            isPlaced
                              ? 'is-placed'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() =>
                            placePartyOnMap(
                              partyNo,
                            )
                          }
                          aria-label={`Party ${partyNo}`}
                        >
                          <span className="war-planner-party-number">
                            P{partyNo}
                          </span>

                          <span className="war-planner-party-state">
                            {isPlaced
                              ? 'วางแล้ว'
                              : 'ยังไม่วาง'}
                          </span>
                        </button>
                      );
                    },
                  )
                )}
              </div>
            )}

          <section className="war-planner-tools">
            <h3>Tools</h3>

            <button
              type="button"
              className={
                toolMode === 'cursor'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                handleToolChange(
                  'cursor',
                )
              }
            >
              Cursor
            </button>

            <button
              type="button"
              className={
                toolMode === 'route'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                handleToolChange(
                  'route',
                )
              }
            >
              Route
            </button>

            <button
              type="button"
              className={
                toolMode === 'note'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                handleToolChange(
                  'note',
                )
              }
            >
              Note
            </button>

            <button
              type="button"
              className={
                toolMode === 'area'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                handleToolChange(
                  'area',
                )
              }
            >
              Area
            </button>

            {toolMode === 'area' && (
              <div className="war-planner-area-tones">
                <button
                  type="button"
                  className={[
                    'danger',
                    areaTone === 'danger'
                      ? 'active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    setAreaTone(
                      'danger',
                    )
                  }
                  aria-label="พื้นที่อันตราย"
                  title="พื้นที่อันตราย"
                />

                <button
                  type="button"
                  className={[
                    'warning',
                    areaTone === 'warning'
                      ? 'active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    setAreaTone(
                      'warning',
                    )
                  }
                  aria-label="พื้นที่เฝ้าระวัง"
                  title="พื้นที่เฝ้าระวัง"
                />

                <button
                  type="button"
                  className={[
                    'safe',
                    areaTone === 'safe'
                      ? 'active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    setAreaTone(
                      'safe',
                    )
                  }
                  aria-label="พื้นที่ปลอดภัย"
                  title="พื้นที่ปลอดภัย"
                />
              </div>
            )}

            {toolMode === 'route' &&
              draftRoutePoints.length >
                0 && (
                <>
                  <button
                    type="button"
                    className="war-planner-finish-route"
                    onClick={
                      finishDraftRoute
                    }
                    disabled={
                      draftRoutePoints.length <
                      2
                    }
                  >
                    จบเส้นทาง
                  </button>

                  <button
                    type="button"
                    className="war-planner-cancel-route"
                    onClick={
                      cancelDraftRoute
                    }
                  >
                    ยกเลิก
                  </button>
                </>
              )}

            <button
              type="button"
              className="war-planner-delete-route"
              onClick={
                deleteSelectedRoute
              }
              disabled={
                !selectedRouteId
              }
            >
              ลบเส้นทาง
            </button>
          </section>
        </aside>

        <div className="war-planner-map-panel">
          <div
            ref={mapRef}
            onClick={
              handleMapNoteClick
            }
            onPointerDown={
              handleAreaCanvasPointerDown
            }
            onPointerMove={
              handleAreaCanvasPointerMove
            }
            onPointerUp={
              handleAreaCanvasPointerUp
            }
            onPointerCancel={
              handleAreaCanvasPointerUp
            }
            className={[
              'war-planner-map-canvas',
              `is-${toolMode}-mode`,
            ].join(' ')}
          >
            <img
              src={currentMap.image}
              alt={`แผนที่ ${currentMap.label}`}
              className="war-planner-map-image"
              draggable={false}
            />

            <div className="war-planner-map-phase-label">
              {
                DEFAULT_PHASES.find(
                  (phase) =>
                    phase.id ===
                    activePhaseId,
                )?.label
              }
            </div>

            {currentAreas.map(
              (area) => (
                <div
                  key={area.id}
                  className={[
                    'war-planner-map-area',
                    `tone-${area.tone}`,

                    selectedAreaId ===
                    area.id
                      ? 'is-selected'
                      : '',

                    draggingAreaId ===
                    area.id
                      ? 'is-dragging'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    left: `${area.centerXPercent}%`,
                    top: `${area.centerYPercent}%`,
                    width: `${area.radiusXPercent * 2}%`,
                    height: `${area.radiusYPercent * 2}%`,
                  }}
                  onPointerDown={(
                    event,
                  ) =>
                    handleAreaPointerDown(
                      event,
                      area.id,
                    )
                  }
                  onPointerMove={(
                    event,
                  ) =>
                    handleAreaPointerMove(
                      event,
                      area.id,
                    )
                  }
                  onPointerUp={
                    handleAreaPointerUp
                  }
                  onPointerCancel={
                    handleAreaPointerUp
                  }
                  onContextMenu={(
                    event,
                  ) =>
                    handleAreaContextMenu(
                      event,
                      area.id,
                    )
                  }
                  title="ลากเพื่อย้าย — คลิกขวาเพื่อลบ"
                >
                  {selectedAreaId ===
                    area.id && (
                    <span
                      className="war-planner-area-resize"
                      onPointerDown={(
                        event,
                      ) =>
                        handleAreaResizePointerDown(
                          event,
                          area.id,
                        )
                      }
                      onPointerMove={(
                        event,
                      ) =>
                        handleAreaResizePointerMove(
                          event,
                          area.id,
                        )
                      }
                      onPointerUp={
                        handleAreaResizePointerUp
                      }
                      onPointerCancel={
                        handleAreaResizePointerUp
                      }
                    />
                  )}
                </div>
              ),
            )}

            {draftArea && (
              <div
                className={[
                  'war-planner-map-area',
                  'is-draft',
                  `tone-${areaTone}`,
                ].join(' ')}
                style={{
                  left: `${(
                    draftArea.startXPercent +
                    draftArea.currentXPercent
                  ) / 2}%`,

                  top: `${(
                    draftArea.startYPercent +
                    draftArea.currentYPercent
                  ) / 2}%`,

                  width: `${Math.abs(
                    draftArea.currentXPercent -
                    draftArea.startXPercent,
                  )}%`,

                  height: `${Math.abs(
                    draftArea.currentYPercent -
                    draftArea.startYPercent,
                  )}%`,
                }}
              />
            )}

            <svg
              className="war-planner-route-layer"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              onClick={
                handleRouteCanvasClick
              }
              onDoubleClick={
                handleRouteCanvasDoubleClick
              }
              onPointerMove={
                handleRouteCanvasPointerMove
              }
              onPointerLeave={
                handleRouteCanvasPointerLeave
              }
              aria-label="ชั้นวาดเส้นทาง"
            >

              {currentRoutes.map(
                (route) => (
                  <g key={route.id}>
                    <path
                      d={buildSmoothRoutePath(
                        route.points,
                      )}
                      className={[
                        'war-planner-route-path',

                        selectedRouteId ===
                        route.id
                          ? 'is-selected'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      vectorEffect="non-scaling-stroke"
                      onPointerDown={(
                        event,
                      ) =>
                        handleRouteSelect(
                          event,
                          route.id,
                        )
                      }
                      onContextMenu={(
                        event,
                      ) =>
                        handleRouteContextMenu(
                          event,
                          route.id,
                        )
                      }
                    />

                    <path
                      d={buildRouteArrowHead(
                        route.points,
                      )}
                      className={[
                        'war-planner-route-chevron',

                        selectedRouteId ===
                        route.id
                          ? 'is-selected'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      vectorEffect="non-scaling-stroke"
                      onPointerDown={(
                        event,
                      ) =>
                        handleRouteSelect(
                          event,
                          route.id,
                        )
                      }
                      onContextMenu={(
                        event,
                      ) =>
                        handleRouteContextMenu(
                          event,
                          route.id,
                        )
                      }
                    />
                  </g>
                ),
              )}

              {visibleDraftPoints.length >
                0 && (
                <>
                  <path
                    d={buildSmoothRoutePath(
                      visibleDraftPoints,
                    )}
                    className="war-planner-route-path is-draft"
                    vectorEffect="non-scaling-stroke"
                  />

                  {visibleDraftPoints.length >
                    1 && (
                    <path
                      d={buildRouteArrowHead(
                        visibleDraftPoints,
                      )}
                      className="war-planner-route-chevron is-draft"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </>
              )}

              {draftRoutePoints.map(
                (point, index) => (
                  <circle
                    key={`draft-${index}`}
                    cx={point.xPercent}
                    cy={point.yPercent}
                    r="1.05"
                    className="war-planner-route-draft-point"
                    vectorEffect="non-scaling-stroke"
                  />
                ),
              )}

              {selectedRoute &&
                toolMode ===
                  'cursor' &&
                selectedRoute.points.map(
                  (point, index) => (
                    <circle
                      key={`${selectedRoute.id}-${index}`}
                      cx={
                        point.xPercent
                      }
                      cy={
                        point.yPercent
                      }
                      r={
                        index ===
                          selectedRoute
                            .points
                            .length -
                            1
                          ? '1.35'
                          : '1.15'
                      }
                      className={[
                        'war-planner-route-handle',

                        index === 0
                          ? 'start'
                          : '',

                        index ===
                        selectedRoute
                          .points
                          .length -
                          1
                          ? 'end'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      vectorEffect="non-scaling-stroke"
                      onPointerDown={(
                        event,
                      ) =>
                        handleRoutePointPointerDown(
                          event,
                          selectedRoute.id,
                          index,
                        )
                      }
                      onPointerMove={
                        handleRoutePointPointerMove
                      }
                      onPointerUp={
                        handleRoutePointPointerUp
                      }
                      onPointerCancel={
                        handleRoutePointPointerUp
                      }
                    />
                  ),
                )}
            </svg>

            {currentNotes.map(
              (note) => (
                <button
                  key={note.id}
                  type="button"
                  className={[
                    'war-planner-map-note',
                    `tone-${note.tone}`,

                    draggingNoteId ===
                    note.id
                      ? 'is-dragging'
                      : '',

                    selectedNoteId ===
                    note.id
                      ? 'is-selected'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    left: `${note.xPercent}%`,
                    top: `${note.yPercent}%`,
                  }}
                  onPointerDown={(
                    event,
                  ) =>
                    handleNotePointerDown(
                      event,
                      note.id,
                    )
                  }
                  onPointerMove={(
                    event,
                  ) =>
                    handleNotePointerMove(
                      event,
                      note.id,
                    )
                  }
                  onPointerUp={
                    handleNotePointerUp
                  }
                  onPointerCancel={
                    handleNotePointerUp
                  }
                  onContextMenu={(
                    event,
                  ) =>
                    handleNoteContextMenu(
                      event,
                      note.id,
                    )
                  }
                  title="ลากเพื่อย้าย — คลิกขวาเพื่อลบ"
                >
                  <span className="war-planner-note-text">
                    {note.text}
                  </span>

                  <span
                    className="war-planner-note-tail"
                    aria-hidden="true"
                  />

                  <span
                    className="war-planner-note-anchor"
                    aria-hidden="true"
                  />

                </button>
              ),
            )}

            {currentMarkers.map(
              (marker) => (
                <button
                  key={marker.partyNo}
                  type="button"
                  className={[
                    'war-planner-map-marker',

                    draggingPartyNo ===
                    marker.partyNo
                      ? 'is-dragging'
                      : '',

                    selectedPartyNo ===
                    marker.partyNo
                      ? 'is-selected'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    left: `${marker.xPercent}%`,
                    top: `${marker.yPercent}%`,
                  }}
                  onPointerDown={(
                    event,
                  ) =>
                    handleMarkerPointerDown(
                      event,
                      marker.partyNo,
                    )
                  }
                  onPointerMove={(
                    event,
                  ) =>
                    handleMarkerPointerMove(
                      event,
                      marker.partyNo,
                    )
                  }
                  onPointerUp={
                    handleMarkerPointerUp
                  }
                  onPointerCancel={
                    handleMarkerPointerUp
                  }
                  onContextMenu={(
                    event,
                  ) =>
                    handleMarkerContextMenu(
                      event,
                      marker.partyNo,
                    )
                  }
                  aria-label={`Party ${marker.partyNo}`}
                  title="ลากเพื่อย้าย — คลิกขวาเพื่อลบ"
                >
                  {marker.partyNo}
                </button>
              ),
            )}
          </div>

          <p className="war-planner-map-help">
            {toolMode === 'cursor'
              ? 'Cursor: ลากเพื่อย้าย • คลิกขวาเพื่อลบ • กด Delete เพื่อลบสิ่งที่เลือก'
              : toolMode === 'route'
                ? 'Route: คลิกวางจุดตามทาง แล้วดับเบิลคลิกหรือกด “จบเส้นทาง”'
                : toolMode === 'note'
                  ? 'Note: คลิกตำแหน่งบนแผนที่แล้วพิมพ์ข้อความ'
                  : toolMode === 'area'
                    ? 'Area: ลากบนแผนที่เพื่อสร้างพื้นที่ แล้วกลับ Cursor เพื่อย้ายหรือปรับขนาด'
                    : 'เลือกเครื่องมือเพื่อเริ่มวางแผน'}
          </p>
        </div>
      </section>


      <div
        className="war-planner-capture-stage"
        aria-hidden="true"
      >
        <div
          ref={captureGridRef}
          className="war-planner-capture-grid"
        >
          {DEFAULT_PHASES.map(
            (phase) => {
              const phaseMarkers =
                markersByPhase[
                  phase.id
                ];

              const phaseRoutes =
                routesByPhase[
                  phase.id
                ];

              const phaseNotes =
                notesByPhase[
                  phase.id
                ];

              const phaseAreas =
                areasByPhase[
                  phase.id
                ];

              return (
                <section
                  key={`capture-${phase.id}`}
                  ref={
                    phase.id ===
                    activePhaseId
                      ? captureCurrentRef
                      : undefined
                  }
                  className="war-planner-capture-card"
                >
                  <div className="war-planner-capture-label">
                    {phase.label}
                  </div>

                  <div className="war-planner-capture-map">
                    <img
                      src={currentMap.image}
                      alt=""
                      className="war-planner-capture-image"
                    />

                    {phaseAreas.map(
                      (area) => (
                        <div
                          key={area.id}
                          className={[
                            'war-planner-capture-area',
                            `tone-${area.tone}`,
                          ].join(' ')}
                          style={{
                            left: `${area.centerXPercent}%`,
                            top: `${area.centerYPercent}%`,
                            width: `${area.radiusXPercent * 2}%`,
                            height: `${area.radiusYPercent * 2}%`,
                          }}
                        />
                      ),
                    )}

                    <svg
                      className="war-planner-capture-route-layer"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      {phaseRoutes.map(
                        (route) => (
                          <g
                            key={route.id}
                          >
                            <path
                              d={buildSmoothRoutePath(
                                route.points,
                              )}
                              className="war-planner-capture-route"
                              fill="none"
                              stroke="#dc2626"
                              strokeWidth={5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                            />

                            <path
                              d={buildRouteArrowHead(
                                route.points,
                              )}
                              className="war-planner-capture-chevron"
                              fill="none"
                              stroke="#dc2626"
                              strokeWidth={5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                            />
                          </g>
                        ),
                      )}
                    </svg>

                    {phaseNotes.map(
                      (note) => (
                        <div
                          key={note.id}
                          className={[
                            'war-planner-capture-note',
                            `tone-${note.tone}`,
                          ].join(' ')}
                          style={{
                            left: `${note.xPercent}%`,
                            top: `${note.yPercent}%`,
                          }}
                        >
                          <span>
                            {note.text}
                          </span>

                          <i
                            className="war-planner-capture-note-tail"
                          />

                          <i
                            className="war-planner-capture-note-anchor"
                          />
                        </div>
                      ),
                    )}

                    {phaseMarkers.map(
                      (marker) => (
                        <div
                          key={marker.partyNo}
                          className="war-planner-capture-marker"
                          style={{
                            left: `${marker.xPercent}%`,
                            top: `${marker.yPercent}%`,
                          }}
                        >
                          {marker.partyNo}
                        </div>
                      ),
                    )}
                  </div>
                </section>
              );
            },
          )}
        </div>
      </div>

      {isMapSwitchDialogOpen && (
        <div
          className="war-planner-note-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeMapSwitchDialog();
            }
          }}
        >
          <section
            className="war-planner-note-dialog war-planner-map-switch-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="war-planner-map-switch-title"
          >
            <header>
              <div>
                <h3 id="war-planner-map-switch-title">
                  เปลี่ยนแผนที่โดยไม่บันทึก?
                </h3>

                <p>
                  แผนของแมพปัจจุบันมีการแก้ไขที่ยังไม่ได้บันทึก
                </p>
              </div>

              <button
                type="button"
                className="war-planner-note-dialog-close"
                onClick={closeMapSwitchDialog}
                aria-label="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </header>

            <div className="war-planner-map-switch-dialog-body">
              <p>
                หากเปลี่ยนแมพตอนนี้ การแก้ไขล่าสุดของ
                <strong> {currentMap.label} </strong>
                จะหายไป
              </p>
            </div>

            <footer>
              <button
                type="button"
                className="secondary"
                onClick={closeMapSwitchDialog}
              >
                กลับไปบันทึกก่อน
              </button>

              <button
                type="button"
                className="war-planner-map-switch-confirm"
                onClick={confirmMapSwitch}
              >
                เปลี่ยนแมพ
              </button>
            </footer>
          </section>
        </div>
      )}

      {isClearDialogOpen && (
        <div
          className="war-planner-note-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeClearPhaseDialog();
            }
          }}
        >
          <section
            className="war-planner-note-dialog war-planner-clear-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="war-planner-clear-dialog-title"
          >
            <header>
              <div>
                <h3
                  id="war-planner-clear-dialog-title"
                >
                  ล้างข้อมูล Phase นี้
                </h3>

                <p>
                  ข้อมูลในช่วงนี้จะถูกลบออกจากแผนที่
                </p>
              </div>

              <button
                type="button"
                className="war-planner-note-dialog-close"
                onClick={
                  closeClearPhaseDialog
                }
                aria-label="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </header>

            <div className="war-planner-clear-dialog-body">
              <div className="war-planner-clear-dialog-phase">
                <span>Phase ที่กำลังล้าง</span>
                <strong>
                  {activePhaseLabel}
                </strong>
              </div>

              <p>
                Party, Route, Note และ Area ของ Phase นี้จะถูกลบทั้งหมด โดยไม่กระทบ Phase อื่น
              </p>
            </div>

            <footer>
              <button
                type="button"
                className="secondary"
                onClick={
                  closeClearPhaseDialog
                }
              >
                ยกเลิก
              </button>

              <button
                type="button"
                className="war-planner-clear-confirm"
                onClick={
                  confirmClearCurrentPhase
                }
              >
                ล้างข้อมูล
              </button>
            </footer>
          </section>
        </div>
      )}

      {pendingNotePosition && (
        <div
          className="war-planner-note-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeNoteDialog();
            }
          }}
        >
          <form
            className="war-planner-note-dialog"
            onSubmit={submitNote}
          >
            <header>
              <div>
                <h3>เพิ่ม Note</h3>

                <p>
                  ข้อความนี้จะแสดงเป็น Callout บนแผนที่
                </p>
              </div>

              <button
                type="button"
                className="war-planner-note-dialog-close"
                onClick={
                  closeNoteDialog
                }
                aria-label="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </header>

            <div className="war-planner-note-dialog-body">
              <label>
                <span>ข้อความ</span>

                <textarea
                  autoFocus
                  rows={5}
                  maxLength={180}
                  value={noteDraftText}
                  onChange={(event) =>
                    setNoteDraftText(
                      event.target.value,
                    )
                  }
                  placeholder="เช่น รอรวมตรงนี้ก่อน แล้วค่อยเข้าพร้อมกัน"
                />
              </label>

              <div className="war-planner-note-tone-picker">
                <span>ประเภท</span>

                <div>
                  <button
                    type="button"
                    className={
                      noteDraftTone === 'note'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setNoteDraftTone(
                        'note',
                      )
                    }
                  >
                    Note
                  </button>

                  <button
                    type="button"
                    className={
                      noteDraftTone === 'danger'
                        ? 'active danger'
                        : 'danger'
                    }
                    onClick={() =>
                      setNoteDraftTone(
                        'danger',
                      )
                    }
                  >
                    Danger
                  </button>

                  <button
                    type="button"
                    className={
                      noteDraftTone === 'success'
                        ? 'active success'
                        : 'success'
                    }
                    onClick={() =>
                      setNoteDraftTone(
                        'success',
                      )
                    }
                  >
                    Good
                  </button>
                </div>
              </div>

              <div
                className={[
                  'war-planner-note-preview',
                  `tone-${noteDraftTone}`,
                ].join(' ')}
              >
                {noteDraftText.trim() ||
                  'ตัวอย่าง Note บนแผนที่'}
              </div>
            </div>

            <footer>
              <button
                type="button"
                className="secondary"
                onClick={
                  closeNoteDialog
                }
              >
                ยกเลิก
              </button>

              <button
                type="submit"
                className="primary"
                disabled={
                  noteDraftText.trim() ===
                  ''
                }
              >
                เพิ่ม Note
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
