const PDN_NAVY = "#0f1c43"
const PDN_ORANGE = "#f15822"

/** Full-width brand strip: white (logo) + navy blue halves. */
export function PdnBrandBanner() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        minHeight: "88px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: "1 1 50%",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "14px 16px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/palawandailynews.png"
          alt="Palawan Daily News"
          style={{
            width: "auto",
            maxWidth: "100%",
            height: "72px",
            objectFit: "contain",
            objectPosition: "left center",
            display: "block",
          }}
        />
      </div>
      <div
        style={{
          flex: "1 1 50%",
          backgroundColor: PDN_NAVY,
        }}
        aria-hidden
      />
    </div>
  )
}

type PdnPayslipHeaderProps = {
  statementTitle?: string | null
}

export function PdnPayslipHeader({ statementTitle = "PAYROLL RECEIPT" }: PdnPayslipHeaderProps) {
  const showTitle = statementTitle != null && statementTitle !== ""

  return (
    <div>
      <PdnBrandBanner />
      {showTitle ? (
        <div
          style={{
            background: "#ffffff",
            padding: "12px 16px 14px",
            borderBottom: `2px solid ${PDN_NAVY}`,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: PDN_NAVY,
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

export const PDN_BRAND_COLORS = {
  navy: PDN_NAVY,
  orange: PDN_ORANGE,
} as const
