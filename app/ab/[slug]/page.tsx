import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ABPlayer from "@/app/components/ABPlayer";
import { getAbPage } from "@/lib/ab-pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getAbPage(slug);
  if (!page) return { robots: { index: false, follow: false } };

  return {
    title: `${page.title} — A/B Review · Saltwaves`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${page.title} — A/B Review · Saltwaves`,
      description: "Private A/B audio comparison",
    },
  };
}

export default async function AbReviewPage({ params }: Props) {
  const { slug } = await params;
  const page = getAbPage(slug);
  if (!page) notFound();

  return <ABPlayer config={page} />;
}
