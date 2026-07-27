import type { Metadata } from "next";
import ServicesPage from "../../components/services-page";

export const metadata: Metadata = {
  title: "Consulting — Fixed-price live & streaming setups | Saltwaves",
  description:
    "Fixed-price packages for streaming setup, production dashboards, and automation workflows. Built by a broadcast engineer with 20 years in TV and live sound.",
  openGraph: {
    title: "Consulting — Fixed-price live & streaming setups | Saltwaves",
    description:
      "Streaming setup, production dashboards, and automation workflows at a fixed price. Delivery in 3 days to 2 weeks.",
    type: "website",
  },
};

export default function Page() {
  return <ServicesPage />;
}
