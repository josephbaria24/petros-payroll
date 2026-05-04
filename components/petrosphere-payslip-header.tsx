const NAVY = "#00044a"
const GOLD = "#ffcf14"

/** Full-width brand strip using transparent logo on brand navy (+ gold / white waves). */
export function PetrosphereBrandBanner() {
  return (
    <div
      style={{
        position: "relative",
        background: NAVY,
        padding: "12px 16px 40px",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/petrosphere.png"
        alt="Petrosphere Incorporated — A Training, Review & Consultancy Company"
        style={{
          width: "50%",
          maxHeight: "132px",
          height: "auto",
          objectFit: "contain",
          objectPosition: "left center",
          display: "block",
          position: "relative",
          zIndex: 1,
        }}
      />

      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1200 40"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "40px",
          display: "block",
          pointerEvents: "none",
        }}
        aria-hidden
      >
        <path
          fill={GOLD}
          d="M0,22 C180,6 380,32 600,14 C820,-4 980,28 1200,12 L1200,40 L0,40 Z"
        />
        <path
          fill="#ffffff"
          d="M0,30 C220,16 420,36 620,24 C820,12 1020,34 1200,22 L1200,40 L0,40 Z"
        />
      </svg>
    </div>
  )
}

type PetrospherePayslipHeaderProps = {
  /** Shown on white under the banner; omit or pass null for banner only */
  statementTitle?: string | null
}

export function PetrospherePayslipHeader({
  statementTitle = "PAYROLL STATEMENT",
}: PetrospherePayslipHeaderProps) {
  const showTitle = statementTitle != null && statementTitle !== ""

  return (
    <div>
      <PetrosphereBrandBanner />
      {showTitle ? (
        <div
          style={{
            background: "#ffffff",
            padding: "12px 16px 14px",
            borderBottom: `2px solid ${NAVY}`,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: NAVY,
              fontFamily: "Arial, Helvetica, system-ui, sans-serif",
            }}
          >
            {statementTitle}
          </h2>
        </div>
      ) : null}
    </div>
  )
}
