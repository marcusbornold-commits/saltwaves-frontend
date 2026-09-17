import {
  getActiveDistansDemoLink,
  toPublicDistansDemoLink,
} from "@/lib/distans-demo";
import type { Metadata } from "next";
import { DistansDemoClient } from "./DistansDemoClient";
import "./demo.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Distans demo — Saltwaves",
  description: "Private Distans mastering demo. Upload raw single-track audio.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function DistansDemoPage({ params }: PageProps) {
  const { token } = await params;

  let link = null;
  let lookupFailed = false;
  try {
    link = await getActiveDistansDemoLink(token);
  } catch {
    lookupFailed = true;
  }

  if (lookupFailed) {
    return (
      <main className="distans-demo-page">
        <div className="distans-demo-shell">
          <p className="distans-demo-kicker">Distans demo</p>
          <h1 className="distans-demo-title">Something went wrong</h1>
          <p className="distans-demo-sub">
            We couldn&apos;t verify this demo link just now. Please try again in
            a moment, or contact Saltwaves for a new link.
          </p>
        </div>
      </main>
    );
  }

  if (!link) {
    return (
      <main className="distans-demo-page">
        <div className="distans-demo-shell">
          <p className="distans-demo-kicker">Distans demo</p>
          <h1 className="distans-demo-title">This link isn&apos;t valid</h1>
          <p className="distans-demo-sub">
            This Distans demo link is invalid or no longer active. Ask Saltwaves
            for a new private link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="distans-demo-page">
      <div className="distans-demo-shell">
        <p className="distans-demo-kicker">Private Distans demo</p>
        <h1 className="distans-demo-title">Hear Distans on your own audio</h1>
        <p className="distans-demo-sub">
          Upload a <strong>raw single-track</strong> recording — the same kind
          of file you&apos;d send for mastering. Do not use a published episode
          or an already-processed mix.
        </p>
        <DistansDemoClient link={toPublicDistansDemoLink(link)} />
      </div>
    </main>
  );
}
