import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { UsersClient } from "./UsersClient";

export default async function FoydalanuvchilarPage() {
  const session = await requireUser();
  if (session.rol !== "admin") {
    redirect("/");
  }

  const [users, businesses] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        ism: true,
        login: true,
        rol: true,
        isActive: true,
        createdAt: true,
        businessId: true,
        business: { select: { nomi: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.business.findMany({ where: { isActive: true }, orderBy: { nomi: "asc" }, select: { id: true, nomi: true } }),
  ]);

  const usersDTO = users.map((u) => ({
    id: u.id,
    ism: u.ism,
    login: u.login,
    rol: u.rol,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    businessId: u.businessId,
    businessNomi: u.business?.nomi ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Foydalanuvchilar</h1>
      <UsersClient initialUsers={usersDTO} currentUserId={session.userId} businesses={businesses} />
    </div>
  );
}
