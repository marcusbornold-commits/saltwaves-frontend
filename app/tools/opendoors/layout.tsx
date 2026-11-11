import type { Metadata } from "next";
import "./opendoors.css";

const title = "Saltwaves – Open Doors";
const description = "Privat ingång för Open Doors och podden Motljus. Ladda upp spår, få ett mastrat avsnitt tillbaka.";
export const metadata: Metadata = {
  title, description, keywords: [],
  robots: { index: false, follow: false },
  openGraph: { title, description, type: "website", siteName: "Saltwaves" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
