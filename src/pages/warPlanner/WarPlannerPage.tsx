import {
  useMemo,
  useRef,
  useState,
} from 'react';

import { useParties } from '../../hooks/useParties';

import warMapImage from '../../assets/warPlanner/war-map.png';

type WarPhaseId =
  | 'start'
  | '15-minutes'
  | '10-minutes';

interface WarPhase {
  id: WarPhaseId;
  label: string;
}

interface PartyMarker {
  partyNo: number;
  xPercent: number;
  yPercent: number;
}

type PhaseMarkerState = Record<
  WarPhaseId,
  PartyMarker[]
>;

const DEFAULT_PHASES: WarPhase[] = [
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

const INITIAL_MARKERS: PhaseMarkerState = {
  start: [],
  '15-minutes': [],
  '10-minutes': [],
};

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

export function WarPlannerPage() {
  const mapRef =
    useRef<HTMLDivElement | null>(null);

  const [
    activePhaseId,
    setActivePhaseId,
  ] = useState<WarPhaseId>('start');

  const [
    markersByPhase,
    setMarkersByPhase,
  ] = useState<PhaseMarkerState>(
    INITIAL_MARKERS,
  );

  const [
    draggingPartyNo,
    setDraggingPartyNo,
  ] = useState<number | null>(null);

  const {
    parties,
    isLoading,
    errorMessage,
    reloadParties,
  } = useParties('guildLeague');

  /*
   * ใช้ 8 ตี้แรกจาก Guild League
   * แต่แสดงเลขตี้เป็น 1–8 เสมอ
   */
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

  const placedPartyNumbers = useMemo(
    () =>
      new Set(
        currentMarkers.map(
          (marker) => marker.partyNo,
        ),
      ),
    [currentMarkers],
  );

  function placePartyOnMap(
    partyNo: number,
  ): void {
    if (
      placedPartyNumbers.has(partyNo)
    ) {
      return;
    }

    /*
     * กระจายจุดเริ่มต้นเล็กน้อย
     * เพื่อไม่ให้ Marker ทุกตี้ทับกัน
     */
    const offsetIndex =
      currentMarkers.length;

    const columns = 4;

    const column =
      offsetIndex % columns;

    const row =
      Math.floor(
        offsetIndex / columns,
      );

    const xPercent =
      38 + column * 8;

    const yPercent =
      43 + row * 10;

    setMarkersByPhase(
      (currentState) => ({
        ...currentState,

        [activePhaseId]: [
          ...currentState[
            activePhaseId
          ],

          {
            partyNo,
            xPercent,
            yPercent,
          },
        ],
      }),
    );
  }

  function removePartyFromMap(
    partyNo: number,
  ): void {
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
  }

  function updateMarkerPosition(
    partyNo: number,
    clientX: number,
    clientY: number,
  ): void {
    const mapElement =
      mapRef.current;

    if (!mapElement) {
      return;
    }

    const mapRect =
      mapElement.getBoundingClientRect();

    const rawXPercent =
      ((clientX - mapRect.left) /
        mapRect.width) *
      100;

    const rawYPercent =
      ((clientY - mapRect.top) /
        mapRect.height) *
      100;

    /*
     * จำกัดไม่ให้วงกลมหลุดออกนอกแมพ
     */
    const xPercent = clamp(
      rawXPercent,
      3,
      97,
    );

    const yPercent = clamp(
      rawYPercent,
      4,
      96,
    );

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
                  xPercent,
                  yPercent,
                }
              : marker,
          ),
      }),
    );
  }

  function handleMarkerPointerDown(
    event:
      React.PointerEvent<HTMLButtonElement>,
    partyNo: number,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setDraggingPartyNo(partyNo);

    updateMarkerPosition(
      partyNo,
      event.clientX,
      event.clientY,
    );
  }

  function handleMarkerPointerMove(
    event:
      React.PointerEvent<HTMLButtonElement>,
    partyNo: number,
  ): void {
    if (
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
      React.PointerEvent<HTMLButtonElement>,
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

  return (
    <main className="war-planner-page">
      <section className="war-planner-toolbar">
        <div>
          <h2>War Planner</h2>

          <p>
            วางตำแหน่งปาร์ตี้และแผนการเล่นตามช่วงเวลา
          </p>
        </div>

        <button
          type="button"
          className="war-planner-save-button"
          disabled
        >
          บันทึก
        </button>
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
                setActivePhaseId(
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
          className="war-planner-add-phase"
          disabled
        >
          + เพิ่มช่วง
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
                          title={
                            isPlaced
                              ? `Party ${partyNo} วางแล้ว`
                              : `วาง Party ${partyNo} ลงแผนที่`
                          }
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
              className="active"
            >
              Cursor
            </button>

            <button
              type="button"
              disabled
            >
              Arrow
            </button>

            <button
              type="button"
              disabled
            >
              Note
            </button>

            <button
              type="button"
              disabled
            >
              Ping
            </button>
          </section>
        </aside>

        <div className="war-planner-map-panel">
          <div
            ref={mapRef}
            className="war-planner-map-canvas"
          >
            <img
              src={warMapImage}
              alt="แผนที่สำหรับวางแผนวอ"
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
                  onDoubleClick={() =>
                    removePartyFromMap(
                      marker.partyNo,
                    )
                  }
                  aria-label={`Party ${marker.partyNo}`}
                  title="ลากเพื่อย้ายตำแหน่ง — ดับเบิลคลิกเพื่อลบ"
                >
                  {marker.partyNo}
                </button>
              ),
            )}
          </div>

          <p className="war-planner-map-help">
            กด Party ทางซ้ายเพื่อวางลงแมพ
            • ลากวงกลมเพื่อย้ายตำแหน่ง
            • ดับเบิลคลิกเพื่อลบ
          </p>
        </div>
      </section>
    </main>
  );
}