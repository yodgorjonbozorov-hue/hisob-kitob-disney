import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Disney Navoiy</h1>
          <p className="text-slate-500 text-sm mt-1">Kirim-Chiqim Hisob-Kitob Tizimi</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
