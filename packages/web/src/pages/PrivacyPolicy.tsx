import { Link } from "react-router";
import { PageMeta } from "@/components/PageMeta";

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <PageMeta
        title="Privacy Policy — Axel"
        description="How Axel collects, uses, and protects your personal data. We do not sell your information or train on your conversations."
        path="/privacy"
      />
      {/* Header */}
      <header className="border-b border-border/60 bg-surface-raised/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-text tracking-tight">
            <span className="text-accent">A</span>xel
          </Link>
          <Link
            to="/#waitlist"
            className="text-sm text-muted hover:text-text transition-colors"
          >
            Join waitlist
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-16 px-6">
        <div className="max-w-4xl mx-auto prose prose-invert prose-slate">
          <h1 className="text-3xl font-bold text-text tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-muted/70 text-sm">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mt-8 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-text">
                1. Introduction
              </h2>
              <p className="text-muted mt-2">
                This Privacy Policy explains how Axel ("we", "us", or "our")
                collects, uses, discloses, and safeguards your information when
                you use our AI assistant platform.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                2. Information We Collect
              </h2>
              <p className="text-muted mt-2">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2 text-muted">
                <li>Account information (name, email, password)</li>
                <li>Conversation history and interactions with Axel</li>
                <li>Files and documents you choose to share</li>
                <li>Usage data and analytics</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                3. How We Use Your Information
              </h2>
              <p className="text-muted mt-2">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2 text-muted">
                <li>Provide and improve our AI assistant services</li>
                <li>Process your transactions and maintain your account</li>
                <li>Communicate with you about updates and support</li>
                <li>Protect against fraud and ensure security</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                4. Data Storage and Security
              </h2>
              <p className="text-muted mt-2">
                Your data is stored securely using industry-standard encryption.
                We implement appropriate technical and organizational measures
                to protect your personal information against unauthorized
                access, alteration, disclosure, or destruction.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                5. Data Sharing
              </h2>
              <p className="text-muted mt-2">
                We do not sell your personal information. We may share your
                information with:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2 text-muted">
                <li>Service providers who assist in our operations</li>
                <li>Legal authorities when required by law</li>
                <li>Business partners with your consent</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                6. Your Rights
              </h2>
              <p className="text-muted mt-2">
                You have the right to access, update, or delete your personal
                information. You may also opt-out of certain data collection or
                processing. Contact us to exercise these rights.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                7. Cookies and Tracking
              </h2>
              <p className="text-muted mt-2">
                We use cookies and similar tracking technologies to enhance your
                experience. You can control cookies through your browser
                settings.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                8. Changes to This Policy
              </h2>
              <p className="text-muted mt-2">
                We may update this Privacy Policy from time to time. We will
                notify you of any material changes by posting the new policy on
                this page.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">9. Contact Us</h2>
              <p className="text-muted mt-2">
                If you have any questions about this Privacy Policy, please
                contact us at admin@evans-software-solutions.com.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <p>© {new Date().getFullYear()} Axel. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-text transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-text transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PrivacyPolicy;
