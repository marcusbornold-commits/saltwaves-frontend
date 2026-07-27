import type { Metadata } from "next";
import PostProductionPage from "../../components/post-production-page";

export const metadata: Metadata = {
  title: "Post-production for podcasts, audiobooks and localisation | Saltwaves",
  description:
    "Broadcast-trained post-production. Raw material in, finished master out against your delivery spec, with a measurement report per file. 24-hour turnaround, processed inside the EU.",
  openGraph: {
    title: "Post-production for podcasts, audiobooks and localisation | Saltwaves",
    description:
      "Broadcast-trained post-production. Raw material in, finished master out against your delivery spec, with a measurement report per file. 24-hour turnaround, processed inside the EU.",
    type: "website",
  },
};

export default function Page() {
  return <PostProductionPage />;
}
