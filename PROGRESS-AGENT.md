# PROGRESS-AGENT.md — avtonom tuzatish agenti jurnali

Bu fayl agent sessiyalari o'rtasidagi yagona xotira. Sessiya uzilsa —
agent shu fayldan qayerda qolganini o'qib davom etadi.

**Manbalar:** `CLAUDE.md`, `docs/AUDIT-2026-08.md`, `docs/CLAUDE-CODE-PROMPTLAR.md`

## Fazalar holati

| Faza | Nomi | Branch | Holat |
|---|---|---|---|
| 0 | CLAUDE.md yaratish | `faza-0-claude-md` | ✅ tugadi |
| 1 | Kritik tuzatishlar | `faza-1-kritik` | ⏳ boshlanmagan |
| 2 | Unumdorlik + UX | `faza-2-perf` | ⏳ boshlanmagan |
| 3 | Xavfsizlik + audit | `faza-3-xavfsizlik` | ⏳ boshlanmagan |
| 4 | Kassa to'liqligi | `faza-4-kassa` | ⏳ boshlanmagan |
| 5 | PostgreSQL + masshtab | `faza-5-postgres` | 🔒 loyiha egasidan ruxsat kutiladi |
| 6 | ERP modullari | `faza-6-*` | ⏳ boshlanmagan |

## Kutilayotgan qo'lda amallar

Hozircha yo'q.

---

## Jurnal

### 2026-08-04 — Faza 0 (tugadi)

**Nima qilindi**
- Loyiha ildizida `CLAUDE.md` yaratildi: arxitektura invariantlari
  (tenant izolyatsiyasi, `rawPrisma` ruxsat etilgan joylar ro'yxati, zod,
  pul = Int, sana konvensiyasi), kod qoidalari (250 satr, `any` taqiqi,
  o'zbek lotin, `$transaction`, `deletedAt: null`, yangi model → BUSINESS_SCOPED +
  ZAXIRA_JADVALLARI), tekshirish qoidalari (build, `--create-only` migratsiya, testlar),
  tegilmaydigan fayllar.
- `docs/AUDIT-2026-08.md` — audit hisoboti repozitoriyga ko'chirildi (backlog manbai).
- `docs/CLAUDE-CODE-PROMPTLAR.md` — faza promptlari to'plami repozitoriyga ko'chirildi.
- `PROGRESS-AGENT.md` (shu fayl) yaratildi.

**Fayllar**
- `CLAUDE.md` (yangi)
- `docs/AUDIT-2026-08.md` (yangi)
- `docs/CLAUDE-CODE-PROMPTLAR.md` (yangi)
- `PROGRESS-AGENT.md` (yangi)

**Keyingi qadam:** Faza 1, Prompt 1.1 — `deletedAt: null` filtri + moliyaviy
amallarni `$transaction` ichiga olish.
