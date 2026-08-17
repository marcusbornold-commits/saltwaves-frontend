import type { Metadata } from "next";
import PostproduktionSida from "../../components/postproduktion-sida";

export const metadata: Metadata = {
  title: "Postproduktion av tal för poddar, ljudböcker och lokalisering | Saltwaves",
  description:
    "Broadcast-tränad postproduktion. Råmaterial in, färdig master ut mot er leveransspec, med en mätrapport per fil. Leverans inom 24 timmar, bearbetning på egen hårdvara inom EU.",
  openGraph: {
    title: "Postproduktion av tal för poddar, ljudböcker och lokalisering | Saltwaves",
    description:
      "Broadcast-tränad postproduktion. Råmaterial in, färdig master ut mot er leveransspec, med en mätrapport per fil. Leverans inom 24 timmar, bearbetning på egen hårdvara inom EU.",
    type: "website",
  },
};

export default function Page() {
  return <PostproduktionSida />;
}
