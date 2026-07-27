import type { Metadata } from "next";
import LocalRunPanel from "./LocalRunPanel";

export const metadata: Metadata = {
  title: "Local Run — Saltwaves",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LocalRunPanel />;
}
