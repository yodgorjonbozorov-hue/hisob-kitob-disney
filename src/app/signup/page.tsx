import { redirect } from "next/navigation";

/**
 * O'z-o'zidan ro'yxatdan o'tish yopilgan (BOS-6). Eski havolalar sinmasligi uchun
 * bu manzil demo so'rovi sahifasiga yo'naltiradi.
 */
export default function SignupPage() {
  redirect("/demo");
}
