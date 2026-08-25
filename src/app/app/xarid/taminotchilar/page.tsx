import { redirect } from "next/navigation";

/** Ta'minotchilar reyestri Ombor ostiga ko'chdi — eski havola yangisiga. */
export default function EskiTaminotchilarPage() {
  redirect("/app/ombor/taminotchilar");
}
