"use client";

export default function ManageBillingButton() {
  async function handleClick() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <button type="button" className="btn-primary-full" onClick={handleClick}>
      Manage billing
    </button>
  );
}
