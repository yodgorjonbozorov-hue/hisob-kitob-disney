/** Modul chiplari — ro'yxatda joy tor, shuning uchun ko'pi "+N" ga yig'iladi. */
export function ModulChiplar({ modullar, maks = 4 }: { modullar: string[]; maks?: number }) {
  if (modullar.length === 0) {
    return <span className="text-xs text-faint">Modul yoqilmagan</span>;
  }
  const korinadi = modullar.slice(0, maks);
  const qolgan = modullar.length - korinadi.length;
  return (
    <span className="text-xs text-muted" title={modullar.join(" • ")}>
      {korinadi.join(" • ")}
      {qolgan > 0 && <span className="text-faint"> +{qolgan}</span>}
    </span>
  );
}
