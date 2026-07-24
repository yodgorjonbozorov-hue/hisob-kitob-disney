import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-fg">Disney Navoiy</h1>
          <p className="text-muted text-sm mt-1">Kirim-Chiqim Hisob-Kitob Tizimi</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
