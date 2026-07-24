import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await requireUser();
  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8 border border-line">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-fg">Parolni o'zgartirish</h1>
          <p className="text-muted text-sm mt-1">
            {session.mustChangePassword
              ? "Xavfsizlik uchun boshlang'ich parolni almashtiring."
              : "Yangi parol o'rnating."}
          </p>
        </div>
        <ChangePasswordForm forced={!!session.mustChangePassword} />
      </div>
    </div>
  );
}
