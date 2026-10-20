import { notFound } from "next/navigation";
import SjobergMaster from "../SjobergMaster";
export const dynamic = "force-dynamic";
// Provmastring (valfri): utdrag → jämför → hela kapitlet. Nås från portalen.
export default function Page() {
  if (process.env.NODE_ENV === "production" && !process.env.AUDIOBOOK_STUDIO_API_URL) notFound();
  return <SjobergMaster />;
}
