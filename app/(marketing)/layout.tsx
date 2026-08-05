import { auth } from "@/auth";
import { Footer, Nav } from "../components/saltwaves-sections";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <>
      <Nav isLoggedIn={Boolean(session?.user)} />
      {children}
      <Footer />
    </>
  );
}
