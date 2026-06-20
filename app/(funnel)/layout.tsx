import { Wordmark } from "../components/saltwaves-ui";

export default function FunnelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "48px 24px 0",
        }}
      >
        <Wordmark href="/" />
      </header>
      {children}
    </>
  );
}
