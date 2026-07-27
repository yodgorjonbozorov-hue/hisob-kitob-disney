import LoginForm from "./LoginForm";
import { DisneyLogo } from "@/components/DisneyLogo";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <DisneyLogo className="w-20 h-24 text-fg mb-4" />
          <h1
            className="text-2xl font-semibold tracking-[0.2em] text-fg"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            DISNEY
          </h1>
          <p className="text-xs tracking-[0.3em] text-muted mt-1">XAQIQIY MUHABBAT</p>
          <p className="text-sm text-faint mt-3">Kirim-chiqim hisob-kitob tizimi</p>
        </div>
        <div className="bg-surface rounded-2xl shadow-card border border-line p-7">
          <LoginForm />
        </div>
        <p className="text-center text-sm text-muted mt-5">
          Yangi kompaniyamisiz?{" "}
          <a href="/signup" className="text-brand font-medium hover:underline">
            14 kun bepul sinab ko'ring
          </a>
        </p>
        <p className="text-center text-2xs text-faint mt-4">Disney Navoiy · since 2017</p>
      </div>
    </div>
  );
}
