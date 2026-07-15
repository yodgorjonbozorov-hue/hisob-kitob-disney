import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { UsersClient } from "./UsersClient";

export default async function FoydalanuvchilarPage() {
  const session = await requireUser();
  if (session.rol !== "admin") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    select: { id: true, ism: true, login: true, rol: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const usersDTO = users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Foydalanuvchilar</h1>
      <UsersClient initialUsers={usersDTO} currentUserId={session.userId} />
    </div>
  );
}
