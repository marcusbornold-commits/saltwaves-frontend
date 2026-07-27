import type { Metadata } from "next";
import ServicesPage from "../../components/services-page";

export const metadata: Metadata = {
  title: "Konsulttjänster – Fast pris, fast leverans | Saltwaves.studio",
  description:
    "Tre paket för live- och streamingproduktion till fast pris: streaming-setup, produktionsdashboard och automationsflöden. Byggda av en ljudtekniker med 20 år i broadcast, TV och live-ljud.",
  keywords:
    "streaming setup, OBS, vMix, Bitfocus Companion, Stream Deck, NDI, liveproduktion, broadcast, konsulttjänster",
  openGraph: {
    title: "Konsulttjänster – Fast pris, fast leverans | Saltwaves.studio",
    description:
      "Streaming-setup, produktionsdashboard och automationsflöden till fast pris. Leverans på 3 dagar till 2 veckor.",
    type: "website",
  },
};

export default function Page() {
  return <ServicesPage />;
}
