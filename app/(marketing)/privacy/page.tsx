import styles from "../legal.module.css";

export const metadata = {
  title: "Privacy Policy — Saltwaves",
  description:
    "How Saltwaves handles your data. Built around an ephemeral model: we process your audio, deliver the result, and delete it within 48 hours.",
};

export default function PrivacyPolicyPage() {
  return (
    <article className={styles.page}>
      <h1>Privacy Policy</h1>
      <p className={styles.updated}>Last updated: 26 June 2026</p>

      <h2>1. Who we are</h2>
      <p>
        This service is operated by <strong>Saltwaves Studio</strong>, a sole
        proprietorship (<em>enskild firma</em>) registered in Sweden and run by
        Marcus Bornold (“we”, “us”, “our”). Saltwaves Studio is the{" "}
        <strong>data controller</strong> for the personal data described in this
        policy.
      </p>
      <ul>
        <li>
          Website:{" "}
          <a href="https://saltwaves.studio">https://saltwaves.studio</a>
        </li>
        <li>
          Contact:{" "}
          <a href="mailto:hello@saltwaves.studio">hello@saltwaves.studio</a>
        </li>
        <li>Registered address: Oskarsparken 6, 702 12 Örebro, Sweden</li>
      </ul>
      <p>
        If you have questions about this policy or how we handle your data,
        email us at the address above.
      </p>

      <h2>2. Our approach: process, deliver, delete</h2>
      <p>
        Saltwaves is built around a simple privacy principle:{" "}
        <strong>we process your audio, deliver the result, and delete it.</strong>{" "}
        We do not build a library of your recordings. For anonymous (free) use,
        no account is required, and your audio is removed automatically within
        48 hours. The sections below explain this in detail.
      </p>

      <h2>3. What we collect, and why</h2>

      <h3>3.1 Anonymous (free) processing</h3>
      <p>When you use the free service without an account:</p>
      <ul>
        <li>
          <strong>Your audio file.</strong> Uploaded so we can process it. It is
          stored only as long as needed to process and deliver the result, and
          is <strong>deleted automatically within 48 hours</strong> (usually
          much sooner). See Section 6.
        </li>
        <li>
          <strong>Your email address — as a delivery address only.</strong> We
          use it to send you a link to your finished file. For anonymous use,
          your email address is <strong>not written to our database</strong>. It
          is passed to our email delivery provider (Resend) solely to deliver
          that one message.
        </li>
        <li>
          <strong>Technical data</strong> (e.g. IP address, request timestamps).
          Used to prevent abuse and enforce usage limits. See Section 4.
        </li>
      </ul>

      <h3>3.2 Account holders (paid plans and Founding Members)</h3>
      <p>If you create an account or buy a plan, we additionally process:</p>
      <ul>
        <li>
          <strong>Account data:</strong> your email address and authentication
          details, stored in our database to operate your account.
        </li>
        <li>
          <strong>Plan and billing data:</strong> your subscription or one-time
          purchase status, plan tier, and the identifiers needed to manage
          billing. Card payments are handled entirely by <strong>Stripe</strong>{" "}
          — we never see or store your full card number.
        </li>
      </ul>

      <h3>3.3 Waitlist and marketing</h3>
      <p>
        If you join our waitlist or subscribe to updates, we process the{" "}
        <strong>email address</strong> you provide, managed through our email
        platform (MailerLite), until you unsubscribe.
      </p>

      <h3>3.4 What we do not do</h3>
      <ul>
        <li>
          We do <strong>not</strong> use your uploaded audio to train our models
          unless you give <strong>separate, explicit consent</strong> (for
          example, via a specific opt-in during a beta or research program).
          Normal use never feeds your audio into training data.
        </li>
        <li>
          We do <strong>not</strong> sell your personal data.
        </li>
        <li>
          We do <strong>not</strong> run advertising profiling on you.
        </li>
      </ul>

      <h2>4. Legal bases (GDPR Article 6)</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Legal basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Processing and delivering your audio</td>
            <td>Performance of a contract (the service you requested)</td>
          </tr>
          <tr>
            <td>Operating accounts and billing</td>
            <td>Performance of a contract</td>
          </tr>
          <tr>
            <td>Abuse prevention, rate limiting, security</td>
            <td>Legitimate interest</td>
          </tr>
          <tr>
            <td>Marketing emails / waitlist</td>
            <td>Consent (withdrawable at any time)</td>
          </tr>
          <tr>
            <td>Using audio for model training</td>
            <td>Separate explicit consent (opt-in only)</td>
          </tr>
        </tbody>
      </table>

      <h2>5. Where your data is processed</h2>
      <p>
        Primary audio processing runs on{" "}
        <strong>our own servers located in Sweden (EEA)</strong>. To operate the
        service we also rely on the sub-processors below. Where a processor is
        located outside the EEA, the transfer is covered by an EU adequacy
        decision or by Standard Contractual Clauses.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Role</th>
            <th>Region</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Saltwaves Studio (own hardware)</td>
            <td>Audio processing</td>
            <td>Sweden (EEA)</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Website hosting</td>
            <td>US — SCCs</td>
          </tr>
          <tr>
            <td>Supabase</td>
            <td>Authentication and account database</td>
            <td>EU (Frankfurt)</td>
          </tr>
          <tr>
            <td>Stripe</td>
            <td>Payment processing</td>
            <td>US/EU — SCCs</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Transactional email (delivery links)</td>
            <td>US — SCCs</td>
          </tr>
          <tr>
            <td>MailerLite</td>
            <td>Marketing email / waitlist</td>
            <td>EU (Lithuania)</td>
          </tr>
          <tr>
            <td>Tailscale</td>
            <td>Secure network connectivity</td>
            <td>US/Canada — SCCs</td>
          </tr>
        </tbody>
      </table>

      <h2>6. How long we keep your data</h2>
      <ul>
        <li>
          <strong>Uploaded audio and processed output:</strong> deleted
          automatically <strong>within 48 hours</strong> of processing.
        </li>
        <li>
          <strong>Anonymous delivery emails:</strong> not stored in our
          database; retained only in our email provider’s transactional logs per
          their policy.
        </li>
        <li>
          <strong>Account, plan and billing data:</strong> kept for as long as
          your account exists, and afterwards only as long as required by law
          (e.g. Swedish bookkeeping rules for invoices).
        </li>
        <li>
          <strong>Marketing/waitlist email:</strong> kept until you unsubscribe.
        </li>
      </ul>

      <h2>7. Your rights</h2>
      <p>
        Under the GDPR you have the right to: access your data; correct it; have
        it erased; restrict or object to processing; data portability; and to
        withdraw consent at any time (without affecting prior processing).
      </p>
      <p>
        To exercise any of these, email{" "}
        <a href="mailto:hello@saltwaves.studio">hello@saltwaves.studio</a>. We
        will respond within one month.
      </p>
      <p>
        You also have the right to lodge a complaint with the Swedish data
        protection authority, <strong>Integritetsskyddsmyndigheten (IMY)</strong>{" "}
        — <a href="https://www.imy.se">https://www.imy.se</a>.
      </p>

      <h2>8. Cookies</h2>
      <p>
        For anonymous free use, no account or tracking cookie is required. We
        use only <strong>strictly necessary cookies</strong> for logged-in
        sessions (authentication) and for secure checkout (Stripe). These do not
        require consent.
      </p>

      <h2>9. Security</h2>
      <p>
        We use access controls, encrypted connections, and short data-retention
        windows to protect your data. The ephemeral design — deleting audio
        within 48 hours — is itself a core security measure: data we no longer
        hold cannot be exposed.
      </p>

      <h2>10. Children</h2>
      <p>
        The service is not directed at children under 16, and we do not
        knowingly collect their personal data.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this policy as the service evolves. The “Last updated”
        date at the top reflects the current version. Material changes will be
        communicated to account holders.
      </p>

      <h2 className={styles.contact}>12. Contact</h2>
      <p>
        Saltwaves Studio —{" "}
        <a href="mailto:hello@saltwaves.studio">hello@saltwaves.studio</a>
      </p>
    </article>
  );
}
