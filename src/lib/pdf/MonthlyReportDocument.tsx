import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatSom, formatPercent, uzOyNomi, pdfSafe } from "@/lib/format";
import { parseMonthString } from "@/lib/date";
import type { MonthlyReport } from "@/lib/queries/report";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
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

        <Text style={styles.sectionTitle}>Kirim taqsimoti</Text>
        <CategoryTable data={report.kirimByCategory} />

        <Text style={styles.sectionTitle}>Chiqim taqsimoti</Text>
        <CategoryTable data={report.chiqimByCategory} />

        <Text style={styles.footer}>{pdfSafe(report.businessNomi)} — avtomatik generatsiya qilingan hisobot</Text>
      </Page>
    </Document>
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
