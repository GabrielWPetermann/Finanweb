import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.role !== "ADMIN") {
    redirect("/");
  }

  return <>{children}</>;
}
