import { notFound } from "next/navigation";
import Library from "./Library";
import "../../audiobook.css"; import "../sjoberg.css"; import "./portal.css";
export const dynamic = "force-dynamic";
export default function Page() { if (process.env.NODE_ENV === "production" && !process.env.AUDIOBOOK_STUDIO_API_URL) notFound(); return <Library />; }
