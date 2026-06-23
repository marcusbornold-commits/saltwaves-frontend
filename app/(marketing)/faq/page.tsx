"use client";

import React from "react";

const FAQ_ITEMS = [
  {
    q: "Where's my file?",
    a: "Check your spam or Promotions folder — delivery emails sometimes land there. Your download link works for 48 hours on every plan. Something still missing? Reply to the delivery email and we'll help.",
  },
  {
    q: "What file types do you support?",
    a: "WAV, MP3, and M4A. Free tier: up to 200 MB and 60 minutes per episode. Creator and Founding plans: up to 500 MB and 180 minutes. Studio has no file-size or duration cap.",
  },
  {
    q: "Which mic type should I pick?",
    a: "Dynamic — SM7B, Samson Q2U, and similar broadcast mics. Condenser — Blue Yeti, AT2020, and studio condensers. Headset / AirPods — built-in or wireless headset mics (we skip heavy AI cleanup). Multiple mics / Not sure — safe default when you're unsure.",
  },
  {
    q: "How long are my files kept?",
    a: "Every plan: your original upload is deleted right after processing. Mastered files stay available to download for 48 hours, then we remove them. Persistent library storage arrives with v2 — until then, download and keep your copy.",
  },
  {
    q: "Refunds and cancellation",
    a: "Cancel anytime from your account — you'll keep access until the end of your billing period. Refunds are handled case by case; reply to any PodMaster email or use Manage billing on your account page.",
  },
];

export default function FaqPage() {
  const [open, setOpen] = React.useState(0);

  return (
    <main className="band" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <div className="container">
        <div>
          <div className="kicker">Help</div>
          <h1 className="section-title">FAQ</h1>
          <p className="section-sub" style={{ maxWidth: "52ch" }}>
            Quick answers to the questions we hear most — before you need to email us.
          </p>
        </div>

        <div className="faq-list">
          {FAQ_ITEMS.map((item, i) => (
            <div className={"faq-item" + (open === i ? " open" : "")} key={item.q}>
              <button
                className="faq-q"
                onClick={() => setOpen(open === i ? -1 : i)}
                aria-expanded={open === i}
              >
                {item.q}
                <svg
                  className="faq-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M9 3v12" />
                  <path d="M3 9h12" />
                </svg>
              </button>
              <div className="faq-a">
                <div>
                  <p>{item.a}</p>
                  {item.q === "Refunds and cancellation" && (
                    <p style={{ marginTop: 12 }}>
                      <a href="/account" className="btn btn-ghost btn-sm">
                        Manage billing
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
