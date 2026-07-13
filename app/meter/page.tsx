import type { Metadata } from "next";
import Meter from "./Meter";

export const metadata: Metadata = {
  title: "Meter — Saltwaves",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Meter />;
}
