import { Document, Page, Text, View, StyleSheet, Svg, Rect, Path } from "@react-pdf/renderer";
import { formatSom, formatPercent, uzOyNomi, pdfSafe } from "@/lib/format";
import { parseMonthString } from "@/lib/date";
import { BRAND, BRAND_SIGNATURE } from "@/lib/brand";
import type { MonthlyReport } from "@/lib/queries/report";

/**
 * Brend belgisi PDF ichida vektor sifatida chiziladi (public/logo-icon.svg bilan bir xil
 * geometriya). Tashqi rasm yuklab olinmaydi — hisobot generatsiyasi tarmoqqa bog'liq emas.
 */
function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 512 512" style={{ width: size, height: size, marginRight: 6 }}>
      <Rect x="234" y="196" width="44" height="216" rx="8" fill={BRAND.rang} />
      <Rect x="88" y="164" width="336" height="56" rx="28" fill={BRAND.rang} />
      <Rect x="96" y="88" width="320" height="56" rx="28" fill={BRAND.rangAkssent} />
      <Path d="M76 244h140c0 38.66-31.34 70-70 70s-70-31.34-70-70z" fill={BRAND.rang} />
      <Path d="M296 244h140c0 38.66-31.34 70-70 70s-70-31.34-70-70z" fill={BRAND.rang} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: BRAND.rang,
    paddingBottom: 8,
    marginBottom: 16,
  },
  brandLockup: { flexDirection: "row", alignItems: "center" },
  brandName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: BRAND.rang },
  brandTagline: { fontSize: 8, color: "#64748b" },
  title: { fontSize: 18, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 11, color: "#64748b", marginBottom: 20 },
  summaryRow: { flexDirection: "row", marginBottom: 20, gap: 12 },
  summaryBox: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryLabel: { fontSize: 9, color: "#64748b", marginBottom: 4 },
  summaryValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 8 },
  table: { width: "100%" },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#cbd5e1", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  colName: { flex: 2 },
  colValue: { flex: 1, textAlign: "right" },
  colPercent: { flex: 1, textAlign: "right" },
  headerText: { fontSize: 9, color: "#64748b" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

export function MonthlyReportDocument({ report }: { report: MonthlyReport }) {
  const { year, monthIndex0 } = parseMonthString(report.month);
  const monthLabel = `${uzOyNomi(monthIndex0)} ${year}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar}>
          <View style={styles.brandLockup}>
            <LogoMark size={20} />
            <Text style={styles.brandName}>{BRAND.nomi}</Text>
          </View>
          <Text style={styles.brandTagline}>{pdfSafe(BRAND.tagline)}</Text>
        </View>

        <Text style={styles.title}>{pdfSafe(report.businessNomi)} — Oylik hisobot</Text>
        <Text style={styles.subtitle}>{monthLabel}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Jami kirim</Text>
            <Text style={styles.summaryValue}>{formatSom(report.jamiKirim)} so'm</Text>
            <Text style={styles.headerText}>O'tgan oyga nisbatan {formatPercent(report.changePct.kirim)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Jami chiqim</Text>
            <Text style={styles.summaryValue}>{formatSom(report.jamiChiqim)} so'm</Text>
            <Text style={styles.headerText}>O'tgan oyga nisbatan {formatPercent(report.changePct.chiqim)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Sof foyda</Text>
            <Text style={styles.summaryValue}>{formatSom(report.sofFoyda)} so'm</Text>
            <Text style={styles.headerText}>O'tgan oyga nisbatan {formatPercent(report.changePct.sofFoyda)}</Text>
          </View>
        </View>

        {/* Avto rejimi: direktor birinchi navbatda shu jadvalni o'qiydi. */}
        {report.avto && report.avto.qatorlar.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Sotilgan mashinalar bo'yicha sof foyda</Text>
            <AvtoTable yakun={report.avto} />
          </>
        )}

        <Text style={styles.sectionTitle}>Kirim taqsimoti</Text>
        <CategoryTable data={report.kirimByCategory} />

        <Text style={styles.sectionTitle}>Chiqim taqsimoti</Text>
        <CategoryTable data={report.chiqimByCategory} />

        <Text style={styles.footer}>
          {BRAND_SIGNATURE} · {pdfSafe(report.businessNomi)} — avtomatik generatsiya qilingan hisobot
        </Text>
      </Page>
    </Document>
  );
}

/** Sotilgan mashinalar: olingan narx, xarajat va sof foyda bir qatorda. */
function AvtoTable({ yakun }: { yakun: NonNullable<MonthlyReport["avto"]> }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.colName, styles.headerText]}>Mashina</Text>
        <Text style={[styles.colValue, styles.headerText]}>Olingan</Text>
        <Text style={[styles.colValue, styles.headerText]}>Xarajat</Text>
        <Text style={[styles.colValue, styles.headerText]}>Sotilgan</Text>
        <Text style={[styles.colValue, styles.headerText]}>Sof foyda</Text>
      </View>
      {yakun.qatorlar.map((q, i) => (
        <View style={styles.tableRow} key={`${q.nomi}-${i}`}>
          <Text style={styles.colName}>
            {pdfSafe(q.nomi)}
            {q.avtoRaqam ? ` (${pdfSafe(q.avtoRaqam)})` : ""}
          </Text>
          <Text style={styles.colValue}>{formatSom(q.olinganNarx)}</Text>
          <Text style={styles.colValue}>{q.xarajat > 0 ? formatSom(q.xarajat) : "—"}</Text>
          <Text style={styles.colValue}>{formatSom(q.sotilganNarx)}</Text>
          <Text style={styles.colValue}>{formatSom(q.sofFoyda)}</Text>
        </View>
      ))}
      <View style={[styles.tableRow, { borderBottomWidth: 0, paddingTop: 5 }]}>
        <Text style={[styles.colName, { fontFamily: "Helvetica-Bold" }]}>
          Jami: {yakun.jamiSotilgan} ta mashina
        </Text>
        <Text style={styles.colValue}>{formatSom(yakun.jamiTannarx)}</Text>
        <Text style={styles.colValue}>{yakun.jamiXarajat > 0 ? formatSom(yakun.jamiXarajat) : "—"}</Text>
        <Text style={styles.colValue}>
          {formatSom(yakun.jamiTannarx + yakun.jamiXarajat + yakun.jamiSofFoyda)}
        </Text>
        <Text style={[styles.colValue, { fontFamily: "Helvetica-Bold" }]}>
          {formatSom(yakun.jamiSofFoyda)}
        </Text>
      </View>
    </View>
  );
}

function CategoryTable({ data }: { data: { nomi: string; summa: number; foiz: number }[] }) {
  if (data.length === 0) {
    return <Text style={{ color: "#94a3b8" }}>Ma'lumot yo'q</Text>;
  }
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.colName, styles.headerText]}>Kategoriya</Text>
        <Text style={[styles.colValue, styles.headerText]}>Summa</Text>
        <Text style={[styles.colPercent, styles.headerText]}>Foiz</Text>
      </View>
      {data.map((item) => (
        <View style={styles.tableRow} key={item.nomi}>
          <Text style={styles.colName}>{pdfSafe(item.nomi)}</Text>
          <Text style={styles.colValue}>{formatSom(item.summa)} so'm</Text>
          <Text style={styles.colPercent}>{item.foiz.toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}
