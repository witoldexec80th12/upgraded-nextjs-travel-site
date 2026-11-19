import { PageLayout } from '@/components/layout/PageLayout';

export default function LegalPage({ type }: { type: 'privacy' | 'terms' | 'cookies' }) {
  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-6 py-20 w-full">
        {type === 'privacy' && <PrivacyContent />}
        {type === 'terms' && <TermsContent />}
        {type === 'cookies' && <CookiesContent />}
      </div>
    </PageLayout>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4" style={{ color: '#2c1810' }}>
        {number}. {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function LegalBasis({
  label,
  basis,
  children,
}: {
  label: string;
  basis: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-xl border border-rose-100 bg-white">
      <p className="font-semibold mb-2" style={{ color: '#2c1810' }}>{label}</p>
      <p className="text-slate-600 leading-relaxed mb-2">{children}</p>
      <p className="text-xs italic" style={{ color: '#9e7b73' }}>
        Legal basis: {basis}
      </p>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-base font-semibold mb-2" style={{ color: '#5a2d20' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Privacy Policy
// ---------------------------------------------------------------------------

function PrivacyContent() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-2" style={{ color: '#2c1810' }}>
        Privacy Policy
      </h1>
      <p className="text-sm mb-10" style={{ color: '#9e7b73' }}>
        Last updated: April 1, 2026
      </p>

      <div className="space-y-10">
        <p className="text-slate-600 leading-relaxed">
          This Privacy Policy explains how casa-giulietta.it collects, uses, and protects personal
          data when you visit our website, contact us, or use our concierge-style ticket assistance
          service. We are committed to handling personal data in a lawful, fair, and transparent
          manner.
        </p>

        <Section number="1" title="Who is responsible for your data">
          <p className="text-slate-600 leading-relaxed">
            The data controller responsible for the processing described in this Privacy Policy is:
          </p>
          <div className="mt-3 p-4 rounded-xl border border-rose-100 bg-white">
            <p className="font-medium" style={{ color: '#2c1810' }}>50 Pomodoros Inc.</p>
            <p className="text-slate-600 mt-1">
              Email:{' '}
              <a href="mailto:info@50pomodoros.com" className="underline hover:opacity-80" style={{ color: '#8b2635' }}>
                info@50pomodoros.com
              </a>
            </p>
          </div>
          <p className="text-slate-600 leading-relaxed mt-3">
            If you have any questions about this Privacy Policy or would like to exercise your rights,
            you can contact us using the details above.
          </p>
        </Section>

        <Section number="2" title="What personal data we may collect">
          <p className="text-slate-600 leading-relaxed mb-3">
            Depending on how you interact with us, we may collect and process the following categories
            of personal data:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>identity and contact data, such as your name, email address, phone number, and billing details;</li>
            <li>booking and transaction data, such as ticket request details, purchase information, payment status, and related communications;</li>
            <li>technical and device data, such as IP address, browser type, device information, operating system, referring website, and usage logs;</li>
            <li>website usage and navigation data, such as pages visited, session activity, clicks, and similar browsing behavior;</li>
            <li>communications data, such as messages you send to us through forms, email, or support channels;</li>
            <li>preference and consent data, such as cookie choices, marketing preferences, and other permissions you provide.</li>
          </ul>
        </Section>

        <Section number="3" title="How we use your personal data">
          <p className="text-slate-600 leading-relaxed mb-4">
            We may use your personal data for the following purposes:
          </p>
          <div className="space-y-5">
            <LegalBasis
              label="A. To provide our services"
              basis="Performance of a contract, or steps taken at your request before entering into a contract."
            >
              We use your personal data to provide concierge assistance, communicate with you about
              your requests or orders, and deliver related customer support.
            </LegalBasis>
            <LegalBasis
              label="B. To respond to inquiries"
              basis="Our legitimate interests in managing customer communications and support, and in some cases steps taken before entering into a contract."
            >
              If you contact us, we use your information to answer your questions, handle support
              requests, and maintain related records.
            </LegalBasis>
            <LegalBasis
              label="C. To operate, secure, and improve the website"
              basis="Our legitimate interests in operating a secure and effective website; where required, consent for non-essential tracking technologies."
            >
              We use technical and usage data to maintain site functionality, monitor performance,
              prevent misuse or fraud, troubleshoot issues, and improve usability.
            </LegalBasis>
            <LegalBasis
              label="D. For analytics"
              basis="Your consent where required for analytics cookies or similar technologies."
            >
              Where enabled, we may use analytics tools to understand how visitors use the website and
              to improve performance, content, and user experience.
            </LegalBasis>
            <LegalBasis
              label="E. For marketing and retargeting"
              basis="Your consent where required for marketing cookies or tracking technologies."
            >
              Where enabled, we may use tools such as advertising or social media pixels to measure
              campaign effectiveness and, where applicable, support remarketing or retargeting
              activities.
            </LegalBasis>
            <LegalBasis
              label="F. To comply with legal obligations"
              basis="Compliance with a legal obligation."
            >
              We may process and retain certain data where necessary to comply with legal, tax,
              accounting, consumer protection, or regulatory requirements.
            </LegalBasis>
          </div>
        </Section>

        <Section number="4" title="Cookies and similar technologies">
          <p className="text-slate-600 leading-relaxed">
            We use cookies and similar technologies to operate the site, analyze usage, remember
            preferences, and, where you consent, support marketing and advertising activities. Where
            required by law, non-essential cookies and similar technologies are used only after you
            have given your consent. You can manage your preferences through our cookie settings tool
            and withdraw consent at any time.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            For more information, please see our{' '}
            <a href="/cookies" className="underline hover:opacity-80" style={{ color: '#8b2635' }}>
              Cookie Policy
            </a>
            .
          </p>
        </Section>

        <Section number="5" title="Sources of personal data">
          <p className="text-slate-600 leading-relaxed mb-3">
            We collect personal data:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>directly from you, for example when you submit a form, contact us, or request ticket assistance;</li>
            <li>automatically when you visit the site, through cookies and similar technologies; and</li>
            <li>from third-party service providers, such as payment processors or analytics platforms, in connection with services we use to operate the site.</li>
          </ul>
        </Section>

        <Section number="6" title="Who we share your data with">
          <p className="text-slate-600 leading-relaxed mb-3">
            We may share your personal data with:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>service providers who help us operate the site, process payments, provide analytics, or deliver customer support — only to the extent necessary for those purposes;</li>
            <li>public authorities, regulators, courts, or law enforcement where required by law or necessary to protect our legal rights.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-4 font-medium" style={{ color: '#2c1810' }}>
            We do not sell your personal data.
          </p>
        </Section>

        <Section number="7" title="International transfers">
          <p className="text-slate-600 leading-relaxed">
            Some of our service providers may process personal data outside the European Economic
            Area. Where this occurs, we take steps intended to ensure that appropriate safeguards are
            in place, in accordance with applicable data protection law. These safeguards may include
            an adequacy decision, standard contractual clauses, or other lawful transfer mechanisms,
            depending on the provider and the circumstances.
          </p>
        </Section>

        <Section number="8" title="How long we keep your data">
          <p className="text-slate-600 leading-relaxed mb-3">
            We keep personal data only for as long as necessary for the purposes described in this
            Privacy Policy, including to provide our services, maintain business records, resolve
            disputes, enforce agreements, and comply with legal obligations. Typical retention periods
            or criteria may include:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>inquiry and customer support data: for as long as needed to respond and for a reasonable follow-up period;</li>
            <li>booking and transaction data: for the duration of the service and any applicable accounting, tax, or legal retention period;</li>
            <li>analytics and marketing data: according to your consent choices, the relevant cookie duration, and business need;</li>
            <li>technical logs and security records: for as long as reasonably necessary for security, fraud prevention, and troubleshooting.</li>
          </ul>
        </Section>

        <Section number="9" title="Your rights">
          <p className="text-slate-600 leading-relaxed mb-3">
            Subject to applicable law, you may have the right to:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>be informed about how your personal data is used;</li>
            <li>access the personal data we hold about you;</li>
            <li>request correction of inaccurate or incomplete personal data;</li>
            <li>request deletion of your personal data in certain circumstances;</li>
            <li>request restriction of processing in certain circumstances;</li>
            <li>object to certain processing, including processing based on legitimate interests;</li>
            <li>receive your data in a portable format where applicable;</li>
            <li>withdraw your consent at any time where processing is based on consent;</li>
            <li>lodge a complaint with a competent data protection authority.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-4">
            To exercise your rights, contact us at:{' '}
            <a href="mailto:info@50pomodoros.com" className="underline hover:opacity-80" style={{ color: '#8b2635' }}>
              info@50pomodoros.com
            </a>
            . We may need to verify your identity before responding.
          </p>
        </Section>

        <Section number="10" title="Children's data">
          <p className="text-slate-600 leading-relaxed">
            This website and our services are not directed to children, and we do not knowingly
            collect personal data from children except where information is provided by a parent,
            guardian, or other adult in connection with a booking or inquiry.
          </p>
        </Section>

        <Section number="11" title="Third-party websites and services">
          <p className="text-slate-600 leading-relaxed">
            Our website may contain links to third-party websites, ticketing systems, payment
            services, or external content. We are not responsible for the privacy practices of
            third-party websites or services, and we encourage you to review their privacy notices
            separately.
          </p>
        </Section>

        <Section number="12" title="Changes to this Privacy Policy">
          <p className="text-slate-600 leading-relaxed">
            We may update this Privacy Policy from time to time to reflect changes in our services,
            legal obligations, or data practices. Any updates will be posted on this page together
            with the revised "Last updated" date.
          </p>
        </Section>

        <Section number="13" title="Contact">
          <p className="text-slate-600 leading-relaxed">
            If you have any questions about this Privacy Policy or how we handle personal data, please
            contact:
          </p>
          <div className="mt-3 p-4 rounded-xl border border-rose-100 bg-white">
            <p className="font-medium" style={{ color: '#2c1810' }}>50 Pomodoros Inc.</p>
            <p className="text-slate-600 mt-1">
              <a href="mailto:info@50pomodoros.com" className="underline hover:opacity-80" style={{ color: '#8b2635' }}>
                info@50pomodoros.com
              </a>
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terms & Conditions
// ---------------------------------------------------------------------------

function TermsContent() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-2" style={{ color: '#2c1810' }}>
        Terms &amp; Conditions
      </h1>
      <p className="text-sm mb-10" style={{ color: '#9e7b73' }}>
        Last updated: April 1, 2026
      </p>

      <div className="space-y-10">
        <p className="text-slate-600 leading-relaxed">
          These Terms &amp; Conditions ("Terms") govern your use of this website (the "Site") and any
          booking made through it. The Site is operated by 50 Pomodoros Incorporated. By using this
          Site or making a booking, you agree to these Terms.
        </p>

        <Section number="1" title="Concierge and Supplier Relationship">
          <p className="text-slate-600 leading-relaxed">
            50 Pomodoros Incorporated operates a concierge service as well as independent online
            booking platforms that help customers discover and reserve attraction tickets and travel
            experiences offered by third-party providers, including attractions, tour operators, and
            authorized ticket distributors (the "Suppliers").
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600 mt-3">
            <li>We are not the operator of the attractions, tours, or experiences listed on the Site.</li>
            <li>We do not manage the venues or control how the experience itself is delivered.</li>
            <li>Our role is to facilitate the booking and payment process and provide customer support related to your reservation.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            When you make a booking through this Site, the contract for the actual experience is
            formed between you and the relevant Supplier. 50 Pomodoros Incorporated acts as the
            platform and facilitator that helps you access, book, and pay for the Supplier's service,
            and receive your booking confirmation or ticket. The Supplier remains solely responsible
            for the experience itself, including admission, operations, timing, accessibility, safety,
            schedule changes, and cancellations.
          </p>
        </Section>

        <Section number="2" title="Supplier Terms">
          <p className="text-slate-600 leading-relaxed">
            Your booking and participation in any experience are also subject to the Supplier's own
            terms, conditions, rules, and entry requirements. By booking through the Site, you agree
            to comply with these supplier terms. If there is a conflict between these Terms of Service
            and the supplier's terms in relation to the delivery of the experience, the Supplier Terms
            will control. 50 Pomodoros Incorporated is not responsible for the content,
            implementation, or enforcement of Supplier Terms.
          </p>
        </Section>

        <Section number="3" title="Prices and Fees">
          <p className="text-slate-600 leading-relaxed mb-3">
            Prices shown at checkout may include:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>the Supplier's ticket price,</li>
            <li>our booking or service fee,</li>
            <li>payment processing costs, and</li>
            <li>other operational or fulfillment-related costs.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Prices may be above face value to reflect service, support, fulfillment work, payment
            handling, and demand. Prices may change at any time before purchase is completed. Where
            currency conversion applies, your bank or payment provider may use its own exchange rate
            and may also charge additional fees outside our control.
          </p>
        </Section>

        <Section number="4" title="Taxes">
          <p className="text-slate-600 leading-relaxed">
            Where required by law or by the Supplier's policies, applicable taxes, including VAT or
            similar sales or consumption taxes, may be included in the displayed price or applied as
            required at checkout. Any tax invoice relating to the experience itself will generally be
            issued by the Supplier where applicable. 50 Pomodoros Incorporated may provide a payment
            receipt for the transaction upon request.
          </p>
        </Section>

        <Section number="5" title="Order Processing">
          <p className="text-slate-600 leading-relaxed">
            Tickets and booking confirmations are delivered electronically. Some bookings are
            fulfilled immediately. Others may be fulfilled later, on an attraction by attraction
            basis, particularly where official inventory is released closer to the visit date.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            You are responsible for providing an accurate email address and for checking your spam or
            junk folders if you do not see your confirmation. Unless otherwise stated, tickets are
            valid only for the specific date and time selected at purchase.
          </p>
        </Section>

        <Section number="6" title="Your Responsibilities">
          <p className="text-slate-600 leading-relaxed mb-3">
            By booking through the Site, you agree to:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>arrive on time, ideally at least 15 minutes before your scheduled entry or start time;</li>
            <li>follow all venue rules, security requirements, and staff instructions;</li>
            <li>bring any required identification and, where relevant, the payment card used for purchase; and</li>
            <li>carefully review names, dates, times, and quantities before completing your booking.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Entry may be refused by the Supplier for reasons outside our control, including late
            arrival, identification issues, venue rules, security restrictions, capacity limits, or
            operational safety decisions.
          </p>
        </Section>

        <Section number="7" title="Changes, Unavailability, and Alternatives">
          <p className="text-slate-600 leading-relaxed">
            If your selected date or time becomes unavailable because of Supplier inventory,
            scheduling, or operational changes, we may offer you an alternative date or time, usually
            the same day or the nearest available option. If no suitable alternative is available, we
            may issue a refund in accordance with Section 9.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            Where we ask for your approval of an alternative, you agree to respond within a reasonable
            timeframe. For near-term visits, this may be as little as a few hours. If we do not
            receive a timely response, we may issue a refund rather than risk delivering tickets that
            are no longer usable.
          </p>
        </Section>

        <Section number="8" title="Cancellations and Refunds">
          <p className="text-slate-600 leading-relaxed mb-3">
            Once a booking has been issued or confirmed, all sales are final unless a refund is
            required by law or expressly permitted under this section. Refunds may be issued only
            where:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>we are unable to fulfill your booking;</li>
            <li>the Supplier cancels the experience and authorizes a refund; or</li>
            <li>there is a verified duplicate charge or a billing or technical error attributable to us.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-4 mb-3">
            Refunds are not available for:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>missed visits, no-shows, or late arrivals;</li>
            <li>changes in your personal schedule;</li>
            <li>travel disruption or delay;</li>
            <li>weather-related issues;</li>
            <li>venue decisions outside our control unless the Supplier authorizes a refund; or</li>
            <li>dissatisfaction with the experience once it has been delivered by the Supplier.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Where a refund is approved, it will be returned to the original payment method wherever
            possible. Processing times depend on the bank or payment provider and may take 5 to 10
            business days or longer.
          </p>
        </Section>

        <Section number="9" title="Payments and Chargebacks">
          <p className="text-slate-600 leading-relaxed">
            If there is an issue with your booking, please contact us first before initiating a
            chargeback. If a chargeback is opened without valid basis, we reserve the right to provide
            relevant supporting documentation to the payment network, bank, or processor, including
            ticket issuance records, supplier confirmations, and customer communications. We may also
            restrict future bookings where chargeback abuse is identified.
          </p>
        </Section>

        <Section number="10" title="Limitation of Liability">
          <p className="text-slate-600 leading-relaxed">
            To the maximum extent permitted by law, 50 Pomodoros Incorporated is not liable for the
            acts, omissions, or decisions of Suppliers, including venue closures, operational changes,
            denied entry, schedule modifications, force majeure events, or the quality of the
            underlying experience. Our total liability for any claim arising out of or relating to a
            booking made through the Site will not exceed the total amount paid by you for that
            booking.
          </p>
        </Section>

        <Section number="11" title="Intellectual Property">
          <p className="text-slate-600 leading-relaxed">
            All content on the Site, including text, graphics, logos, layouts, and design elements,
            is owned by or licensed to 50 Pomodoros Incorporated and may not be copied, reproduced,
            distributed, or reused without prior written permission.
          </p>
        </Section>

        <Section number="12" title="Changes to These Terms">
          <p className="text-slate-600 leading-relaxed">
            We may update these Terms from time to time. Any changes will be reflected by updating
            the "Last updated" date at the top of this page. By continuing to use the Site after
            changes are posted, you agree to the revised Terms.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            You can contact us with any questions at:
          </p>
          <div className="mt-3 p-4 rounded-xl border border-rose-100 bg-white">
            <p className="font-medium" style={{ color: '#2c1810' }}>50 Pomodoros Incorporated</p>
            <p className="text-slate-600 mt-1">
              <a href="mailto:info@50pomodoros.com" className="underline hover:opacity-80" style={{ color: '#8b2635' }}>
                info@50pomodoros.com
              </a>
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cookie Policy
// ---------------------------------------------------------------------------

function CookiesContent() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-2" style={{ color: '#2c1810' }}>
        Cookie Policy
      </h1>
      <p className="text-sm mb-10" style={{ color: '#9e7b73' }}>
        Last updated: April 1, 2026
      </p>

      <div className="prose-content space-y-10" style={{ color: '#3d2018' }}>
        <p className="leading-relaxed text-slate-600">
          This Cookie Policy explains how casa-giulietta.it uses cookies and similar technologies when
          you visit the site. We use cookies for a few straightforward reasons: to make sure the
          website works properly, to better understand how visitors use it, and, where you have given
          consent, to support analytics and marketing activity.
        </p>
        <p className="leading-relaxed text-slate-600">
          Under applicable law, we can place cookies on your device without prior consent only where
          they are strictly necessary for the operation of the site or for a service you have
          specifically requested. Any other cookies, including analytics, functionality, and marketing
          cookies, are used only if you choose to accept them.
        </p>

        <Section number="1" title="What are cookies?">
          <p className="text-slate-600 leading-relaxed">
            Cookies are small text files stored on your device when you visit a website. They help
            websites function properly, remember settings, understand usage patterns, and in some cases
            support advertising or personalization.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            We may also use related technologies such as pixels, tags, scripts, or local storage for
            similar purposes. For simplicity, this policy refers to all of these as "cookies" unless
            we say otherwise.
          </p>
        </Section>

        <Section number="2" title="The types of cookies we use">
          <SubSection title="Strictly necessary cookies">
            <p className="text-slate-600 leading-relaxed">
              These cookies are essential for the website to function properly. They support core
              features such as page navigation, security, network management, and access to requested
              services. Because these cookies are necessary for the site to work, they do not require
              prior consent.
            </p>
          </SubSection>
          <SubSection title="Analytics cookies">
            <p className="text-slate-600 leading-relaxed">
              These cookies help us understand how people use the site. For example, they may show
              which pages are visited, how long users stay on the website, and whether any technical
              issues occur. We use this information to improve the performance, clarity, and usability
              of the site. Analytics cookies are only used where you have given consent, unless a
              specific implementation qualifies for an exemption under applicable law.
            </p>
          </SubSection>
          <SubSection title="Marketing and advertising cookies">
            <p className="text-slate-600 leading-relaxed">
              These cookies may be used to understand browsing activity across websites, support more
              relevant advertising, or measure campaign performance. They may be set by us or by
              third-party providers such as advertising or social media platforms. These cookies are
              only used if you choose to accept them.
            </p>
          </SubSection>
          <SubSection title="Functionality cookies">
            <p className="text-slate-600 leading-relaxed">
              These cookies remember choices you make, such as language, region, or other settings,
              and help provide a more tailored experience. Where they are not strictly necessary, they
              are used only with your consent.
            </p>
          </SubSection>
        </Section>

        <Section number="3" title="Legal basis for using cookies">
          <p className="text-slate-600 leading-relaxed mb-3">
            We rely on two main legal bases:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>
              <strong>Strict necessity</strong> — where a cookie is required for the operation of the
              website or for a service you have explicitly requested; and
            </li>
            <li>
              <strong>Your consent</strong> — for all other cookies where consent is required,
              including analytics, functionality, and marketing cookies.
            </li>
          </ul>
        </Section>

        <Section number="4" title="How consent works">
          <p className="text-slate-600 leading-relaxed mb-3">
            When you first visit the site, you are presented with a cookie banner or consent tool that
            lets you:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>accept all optional cookies,</li>
            <li>reject all optional cookies, or</li>
            <li>manage your preferences by category.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Optional cookies are not placed on your device until you have given consent, unless they
            are strictly necessary for the operation of the site. Consent must be freely given,
            specific, informed, and unambiguous.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            You can change or withdraw your cookie preferences at any time by clicking the Cookie
            Settings link available on the site.
          </p>
        </Section>

        <Section number="5" title="Third-party cookies">
          <p className="text-slate-600 leading-relaxed mb-3">
            Some cookies may be placed by third-party services that appear on the site or that we use
            to support analytics, advertising, embedded content, or social media functionality.
            Depending on the tools active on the site, these third parties may include:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600">
            <li>Google Analytics</li>
            <li>Meta Pixel</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            These third parties may process personal data in accordance with their own privacy and
            cookie policies, so we recommend reviewing those directly if you would like more detail.
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-slate-600 mt-3">
            <li>
              Google Privacy Policy:{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-80"
                style={{ color: '#8b2635' }}
              >
                policies.google.com/privacy
              </a>
            </li>
            <li>
              Meta Privacy Policy:{' '}
              <a
                href="https://www.facebook.com/privacy/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-80"
                style={{ color: '#8b2635' }}
              >
                facebook.com/privacy/policy
              </a>
            </li>
          </ul>
        </Section>

        <Section number="6" title="Cookie list">
          <p className="text-slate-600 leading-relaxed">
            A detailed list of the cookies and similar technologies used on this website is available
            on request. Please contact us at{' '}
            <a
              href="mailto:info@50pomodoros.com"
              className="underline hover:opacity-80"
              style={{ color: '#8b2635' }}
            >
              info@50pomodoros.com
            </a>{' '}
            if you would like further information.
          </p>
        </Section>
      </div>
    </div>
  );
}
