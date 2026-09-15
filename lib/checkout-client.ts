export async function startCheckout(priceId: string): Promise<void> {
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ price_id: priceId }),
  });

  if (response.status === 401) {
    const callbackUrl = encodeURIComponent(
      `${window.location.pathname}${window.location.search}`
    );
    window.location.href = `/login?callbackUrl=${callbackUrl}`;
    return;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" ? data.error : "Checkout failed. Please try again.");
  }

  const data: { url?: string } = await response.json();
  if (data.url) {
    window.location.href = data.url;
  }
}
