import { notFound } from "next/navigation";
import BookView from "./BookView";
import "../../../audiobook.css"; import "../../sjoberg.css"; import "../portal.css";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ book: string }> }) {
  const { book } = await params;
  if (!/^[0-9a-f-]{36}$/.test(book) || (process.env.NODE_ENV === "production" && !process.env.AUDIOBOOK_STUDIO_API_URL)) notFound();
  return <BookView id={book} />;
}
