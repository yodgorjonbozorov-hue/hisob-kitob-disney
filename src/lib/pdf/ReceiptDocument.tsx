import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatSom, pdfSafe } from "@/lib/format";
import { BRAND } from "@/lib/brand";

/**
 * SOTUV CHEKI — 80 mm termal printer formati.
 *
 * Kenglik 80 mm (226.77 pt), balandligi kontentga qarab o'sadi ("auto").
 * Shrift Helvetica: @react-pdf standart shriftlari orasida faqat shu kafolatli
 * mavjud, kirill yoki maxsus belgilar esa `pdfSafe` bilan tozalanadi
 * (oylik hisobotdagi bilan bir xil yondashuv).
 */

export interface ReceiptData {
  businessNomi: string;
  saleId: string;
  sana: string;
  mahsulot: string;
  birlik: string;
  miqdor: number;
  birlikNarx: number;
  jamiSumma: number;
  tolovTuri: string;
  mijozNomi: string | null;
  /** Qarzga sotilgan bo'lsa — qolgan summa. */
  qolganQarz: number | null;
  kassir: string;
}

const styles = StyleSheet.create({
  page: { paddingVertical: 10, paddingHorizontal: 8, fontSize: 8, fontFamily: "Helvetica" },
  markaz: { textAlign: "center" },
  brand: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", color: BRAND.rang },
  biznes: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 2 },
  ajratgich: { borderBottomWidth: 1, borderBottomColor: "#000", borderBottomStyle: "dashed", marginVertical: 6 },
  qator: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  qatorLabel: { color: "#333" },
  mahsulot: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  jami: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  jamiMatn: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  qarz: { marginTop: 4, fontFamily: "Helvetica-Bold" },
  izoh: { fontSize: 7, color: "#555", textAlign: "center", marginTop: 8 },
});

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const qarzga = data.tolovTuri === "qarz";
  return (
    <Document>
      {/* 80 mm = 226.77 pt; balandlik kontentga moslashadi. */}
      <Page size={{ width: 226.77 }} style={styles.page}>
        <Text style={styles.brand}>{pdfSafe(BRAND.nomi)}</Text>
        <Text style={styles.biznes}>{pdfSafe(data.businessNomi)}</Text>

        <View style={styles.ajratgich} />

        <View style={styles.qator}>
          <Text style={styles.qatorLabel}>Sana:</Text>
          <Text>{pdfSafe(data.sana)}</Text>
        </View>
        <View style={styles.qator}>
          <Text style={styles.qatorLabel}>Chek:</Text>
          <Text>{pdfSafe(data.saleId.slice(-8).toUpperCase())}</Text>
        </View>
        <View style={styles.qator}>
          <Text style={styles.qatorLabel}>Kassir:</Text>
          <Text>{pdfSafe(data.kassir)}</Text>
        </View>

        <View style={styles.ajratgich} />

        <Text style={styles.mahsulot}>{pdfSafe(data.mahsulot)}</Text>
        <View style={styles.qator}>
          <Text style={styles.qatorLabel}>
            {data.miqdor} {pdfSafe(data.birlik)} x {formatSom(data.birlikNarx)}
          </Text>
          <Text>{formatSom(data.jamiSumma)}</Text>
        </View>

        <View style={styles.ajratgich} />

        <View style={styles.jami}>
          <Text style={styles.jamiMatn}>JAMI</Text>
          <Text style={styles.jamiMatn}>{formatSom(data.jamiSumma)}</Text>
        </View>
        <View style={styles.qator}>
          <Text style={styles.qatorLabel}>To&apos;lov:</Text>
          <Text>{qarzga ? "Qarzga" : "Naqd"}</Text>
        </View>

        {qarzga && (
          <>
            {data.mijozNomi && (
              <View style={styles.qator}>
                <Text style={styles.qatorLabel}>Mijoz:</Text>
                <Text>{pdfSafe(data.mijozNomi)}</Text>
              </View>
            )}
            {data.qolganQarz !== null && (
              <Text style={styles.qarz}>Qolgan qarz: {formatSom(data.qolganQarz)}</Text>
            )}
          </>
        )}

        <View style={styles.ajratgich} />
        <Text style={styles.izoh}>Xaridingiz uchun rahmat!</Text>
        <Text style={styles.izoh}>{pdfSafe(BRAND.domen)}</Text>
      </Page>
    </Document>
  );
}
