import { notFound } from "next/navigation";
import SjobergMaster from "./SjobergMaster";
// Sjöberg förlag: helt automatisk mastering, bara specen Audiobook Nordic (låst kedja + pausexpander). Åtkomst via invite (scope "sjoberg") i proxy.ts.
// Inte för prod ännu: i production krävs en riktig backend-URL (AUDIOBOOK_STUDIO_API_URL).
export default function Page() {
  if (process.env.NODE_ENV === "production" && !process.env.AUDIOBOOK_STUDIO_API_URL) notFound();
  return <SjobergMaster />;
}
