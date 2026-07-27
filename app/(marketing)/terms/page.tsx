import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service — Saltwaves",
  description:
    "Terms governing your use of Saltwaves: plans, availability, liability, and governing law.",
};

export default function TermsOfServicePage() {
  return (
    <article className={styles.page}>
      <h1>Terms of Service</h1>
      <p className={styles.updated}>Last updated: 27 July 2026</p>

      <h2>The service</h2>
      <p>Automated post-processing of recorded speech.</p>

      <h2>Free tier</h2>
      <p>
        Three episodes per month, no account required, no guaranteed
        availability or turnaround.
      </p>

      <h2>Paid tiers</h2>
      <p>Creator and Studio, billed monthly or annually.</p>

      <h2>Founding lifetime</h2>
      <p>
        Grants access to the Creator tier as defined at the time of purchase,
        with 10 hours of processing per month. It does not cover standalone
        future products, and does not cover the RSS portal, which is a
        separate paid feature.
      </p>

      <h2>Your responsibility</h2>
      <p>
        You confirm you hold the rights to any material you upload. The service
        is built for speech. It is not a music mastering service.
      </p>

      <h2>Availability</h2>
      <p>
        The service is provided as is. We do not guarantee uninterrupted
        availability.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        Liability is limited to the fees paid for the period to which the claim
        relates.
      </p>

      <h2>Right of withdrawal</h2>
      <p>
        Consumers in the EU have a 14-day right of withdrawal. By starting to
        use the service within that period you expressly consent to immediate
        performance and acknowledge that the right of withdrawal is lost once
        the service has been fully performed.
      </p>

      <h2>Changes</h2>
      <p>
        Changes to these terms are published on this page. A Founding lifetime
        purchase already made is not affected by later changes to the definition
        of the Creator tier.
      </p>

      <h2>Governing law</h2>
      <p>
        Swedish law. Mandatory consumer protection rights in your country of
        residence are unaffected.
      </p>
    </article>
  );
}
