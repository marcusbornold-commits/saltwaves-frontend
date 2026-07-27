import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy — Saltwaves",
  description:
    "How Saltwaves handles your personal data: what we collect, how long we keep it, and your rights under GDPR.",
};

export default function PrivacyPolicyPage() {
  return (
    <article className={styles.page}>
      <h1>Privacy Policy</h1>
      <p className={styles.updated}>Last updated: 27 July 2026</p>

      <h2>Controller</h2>
      <p>
        Marcus Bornold, sole proprietorship trading as Saltwaves Studio,
        Oskarsparken 6, 702 12 Örebro, Sweden. Contact:{" "}
        <a href="mailto:hello@saltwaves.studio">hello@saltwaves.studio</a>
      </p>

      <h2>What we collect</h2>
      <p>
        Your email address, used to deliver the processed file, and the audio
        file you upload.
      </p>

      <h2>Free tier</h2>
      <p>
        Your email address is used solely to deliver your file. It is never
        written to a database and no account is created.
      </p>

      <h2>Retention</h2>
      <p>
        Uploaded files are deleted after processing. Delivered files are deleted
        within 48 hours. This applies to all tiers.
      </p>

      <h2>Where processing happens</h2>
      <p>
        On our own hardware within the EU. No audio is sent to third-party
        APIs.
      </p>

      <h2>Paid accounts</h2>
      <p>
        Account details are stored to provide the service. Payments are handled
        by Stripe, acting as a data processor. Stripe may process data outside
        the EU under Standard Contractual Clauses.
      </p>

      <h2>Your rights under GDPR</h2>
      <p>
        Access, rectification, erasure, data portability, restriction and
        objection. Send requests to{" "}
        <a href="mailto:hello@saltwaves.studio">hello@saltwaves.studio</a>. You
        also have the right to lodge a complaint with the Swedish Authority for
        Privacy Protection (IMY).
      </p>

      <h2>Cookies</h2>
      <p>
        We use only what is required to operate the service. No advertising or
        cross-site tracking.
      </p>

      <h2>Data Processing Agreement</h2>
      <p>
        A Data Processing Agreement under GDPR Article 28 is available to
        business customers on request.
      </p>
    </article>
  );
}
