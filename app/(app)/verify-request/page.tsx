import Logo from "@/components/Logo";
import Link from "next/link";
import "../login/login.css";

export default function VerifyRequestPage() {
  return (
    <main className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <Logo />
        </div>

        <h1 className="login-title">Check your inbox</h1>
        <p className="login-sub">
          We sent a sign-in link to your email. It expires in 24 hours.
        </p>
        <p
          className="login-sub"
          style={{ fontSize: 13, marginBottom: 0 }}
        >
          Didn&apos;t get it? Check your spam folder, or{" "}
          <Link href="/login" style={{ color: "#ff6200" }}>
            try again
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
