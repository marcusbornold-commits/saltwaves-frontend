import styles from "../legal.module.css";

export const metadata = {
  title: "Terms of Service — Saltwaves",
  description:
    "The terms that govern your use of Saltwaves products, including PodMaster: plans, content ownership, acceptable use, and Swedish governing law.",
};

export default function TermsOfServicePage() {
  return (
    <article className={styles.page}>
      <h1>Terms of Service</h1>
      <p className={styles.updated}>Last updated: 26 June 2026</p>

      <h2>1. Agreement</h2>
      <p>
        These Terms of Service (“Terms”) govern your use of the products and
        websites operated by <strong>Saltwaves Studio</strong>, a sole
        proprietorship (<em>enskild firma</em>) registered in Sweden
        (“Saltwaves”, “we”, “us”). By using the service, you agree to these
        Terms. If you do not agree, do not use the service.
      </p>

      <h2>2. The service</h2>
      <p>
        Saltwaves provides AI-assisted audio tools, including{" "}
        <strong>PodMaster</strong>, a podcast mastering tool that processes audio
        you upload and returns a processed result. Features and tools may change,
        be added, or be removed over time.
      </p>

      <h2>3. Eligibility</h2>
      <p>
        You must be at least 16 years old (or the age of digital consent in your
        country) to use the service. By using it, you confirm you meet this
        requirement.
      </p>

      <h2>4. Accounts and access</h2>
      <ul>
        <li>
          <strong>Anonymous (free) use</strong> does not require an account. You
          provide an email address only so we can deliver your result.
        </li>
        <li>
          <strong>Registered use</strong> (paid plans, Founding Members) requires
          an account. You are responsible for keeping your login details secure
          and for activity under your account.
        </li>
      </ul>

      <h2>5. Plans, billing and Founding Members</h2>
      <ul>
        <li>
          We offer a free tier and paid plans. The current plans, features and
          prices are shown on our <strong>pricing page</strong> and at checkout,
          which govern at the time of purchase.
        </li>
        <li>
          Paid subscriptions renew automatically for the chosen billing period
          until cancelled. You can cancel at any time; cancellation takes effect
          at the end of the current paid period.
        </li>
        <li>
          <strong>Founding Member</strong> access is a{" "}
          <strong>one-time purchase</strong> that grants a lifetime Creator-tier
          plan as described at the point of sale. It applies to the products
          stated at purchase and does <strong>not</strong> automatically include
          future standalone products.
        </li>
        <li>Payments are processed by Stripe. Taxes are applied where required.</li>
        <li>
          Except where required by law (including Swedish/EU consumer-withdrawal
          rights where they apply), fees are non-refundable.
        </li>
      </ul>

      <h2>6. Free tier and fair use</h2>
      <p>
        The free tier is provided as-is and may be subject to usage limits, rate
        limiting, and file-size or duration caps to keep the service available
        to everyone. We may adjust these limits, and we may suspend access where
        we detect abuse or attempts to circumvent limits.
      </p>

      <h2>7. Your content</h2>
      <ul>
        <li>
          <strong>You own your audio.</strong> Uploading it does not transfer
          ownership to us.
        </li>
        <li>
          You grant us a <strong>limited licence</strong> to process, store and
          transmit your audio <strong>solely</strong> to provide the service to
          you (processing and delivering your result).
        </li>
        <li>
          Uploaded audio and output are{" "}
          <strong>deleted automatically within 48 hours</strong>, consistent with
          our Privacy Policy.
        </li>
        <li>
          We will <strong>not</strong> use your audio to train our models unless
          you give <strong>separate, explicit consent</strong>.
        </li>
        <li>
          You confirm you have the rights to the audio you upload and that
          processing it does not infringe anyone else’s rights.
        </li>
      </ul>

      <h2>8. Acceptable use</h2>
      <p>
        You agree not to use the service to: upload unlawful content or content
        you have no rights to; infringe intellectual-property or privacy rights;
        attempt to reverse-engineer, scrape, overload, or circumvent the limits
        or security of the service; or resell the service without our written
        permission.
      </p>

      <h2>9. Our intellectual property</h2>
      <p>
        The service, including its software, models, processing pipeline,
        branding and content, is owned by Saltwaves and protected by law. These
        Terms grant you a limited right to use the service — not any ownership of
        it.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The service is provided <strong>“as is” and “as available”</strong>.
        Audio processing is automated and results may vary depending on your
        source material; we do not warrant any specific outcome, quality, or
        fitness for a particular purpose. We do not guarantee uninterrupted or
        error-free operation.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Saltwaves is not liable for
        indirect, incidental, or consequential damages, or for loss of data,
        revenue, or profits. Our total liability for any claim relating to the
        service is limited to the amount you paid us for the service in the 12
        months before the claim. Nothing in these Terms limits liability that
        cannot be limited under Swedish law, including liability for intent or
        gross negligence and your statutory consumer rights.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may stop using the service at any time. We may suspend or terminate
        access if you breach these Terms or use the service unlawfully. On
        termination, your right to use the service ends; provisions that by their
        nature should survive (e.g. ownership, disclaimers, liability) will
        survive.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms as the service evolves. The “Last updated” date
        reflects the current version. Continued use after changes take effect
        means you accept the updated Terms; we will notify account holders of
        material changes.
      </p>

      <h2>14. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of <strong>Sweden</strong>. Disputes
        are subject to the Swedish courts, unless mandatory consumer-protection
        rules in your country of residence give you the right to bring
        proceedings elsewhere. EU consumers may also use the European
        Commission’s online dispute-resolution platform.
      </p>

      <h2 className={styles.contact}>15. Contact</h2>
      <p>
        Saltwaves Studio —{" "}
        <a href="mailto:hello@saltwaves.studio">hello@saltwaves.studio</a>
      </p>
    </article>
  );
}
