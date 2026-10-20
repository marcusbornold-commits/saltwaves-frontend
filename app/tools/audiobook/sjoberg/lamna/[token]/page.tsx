import { notFound } from "next/navigation";
import Drop from "./Drop";
import "../../../audiobook.css"; import "../../sjoberg.css"; import "../../portal/portal.css";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  return <Drop token={token} />;
}
