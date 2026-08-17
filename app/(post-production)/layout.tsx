import { Footer } from "../components/saltwaves-sections";

export default function PostProductionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Footer omitFounding b2b />
    </>
  );
}
