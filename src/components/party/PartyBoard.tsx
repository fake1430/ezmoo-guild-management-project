interface PartyBoardProps {
  modeLabel: string;
}

export function PartyBoard({
  modeLabel,
}: PartyBoardProps) {
  return (
    <section className="party-board">
      <div className="panel-heading">
        <div>
          <h2>{modeLabel} Party</h2>
          <p>พื้นที่จัดปาร์ตี้ ปาร์ตี้ละ 5 คน</p>
        </div>

        <button type="button" className="add-party-button">
          + เพิ่มปาร์ตี้
        </button>
      </div>

      <div className="party-placeholder">
        <div className="placeholder-party">
          <h3>Party 1</h3>

          {Array.from({ length: 5 }, (_, index) => (
            <div
              className="placeholder-slot"
              key={index}
            >
              Empty
            </div>
          ))}
        </div>

        <p>
          ขั้นถัดไปจะโหลดปาร์ตี้จริงจาก Google Sheets
        </p>
      </div>
    </section>
  );
}