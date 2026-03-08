import { Link } from "react-router";

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-surface-raised">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-text">
            <span className="text-accent">A</span>xel
          </Link>
          <Link
            to="/login"
            className="text-sm text-muted hover:text-accent transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-12 px-4">
        <div className="max-w-4xl mx-auto prose prose-invert prose-slate">
          <h1 className="text-3xl font-bold text-text">Terms of Service</h1>
          <p className="text-muted">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mt-8 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-text">
                1. Acceptance of Terms
              </h2>
              <p className="text-muted mt-2">
                By accessing and using Axel ("the Service"), you accept and
                agree to be bound by the terms and provision of this agreement.
                If you do not agree to these terms, please do not use our
                Service.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                2. Description of Service
              </h2>
              <p className="text-muted mt-2">
                Axel is an AI-powered assistant platform that provides automated
                assistance, task management, and integration capabilities. The
                Service includes access to AI-powered conversations, automation
                workflows, and various integrations with third-party services.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                3. User Accounts
              </h2>
              <p className="text-muted mt-2">
                To use the Service, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2 text-muted">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Promptly update any changes to your information</li>
                <li>
                  Accept responsibility for all activities under your account
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                4. Acceptable Use Policy
              </h2>
              <p className="text-muted mt-2">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2 text-muted">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Generate harmful, abusive, or illegal content</li>
                <li>Attempt to gain unauthorized access to systems</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                5. Intellectual Property
              </h2>
              <p className="text-muted mt-2">
                The Service and its original content, features, and
                functionality are owned by Axel and are protected by
                international copyright, trademark, patent, trade secret, and
                other intellectual property laws. You retain ownership of
                content you submit to the Service, but grant us a license to
                use, store, and process such content to provide the Service.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                6. Payment and Subscription
              </h2>
              <p className="text-muted mt-2">
                Some features of the Service require a paid subscription. By
                subscribing, you agree to pay all fees associated with your
                plan. Subscriptions automatically renew unless cancelled at
                least 24 hours before the end of the current billing period.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                7. Termination
              </h2>
              <p className="text-muted mt-2">
                We reserve the right to terminate or suspend your account
                immediately, without prior notice or liability, for any reason,
                including breach of these Terms. Upon termination, your right to
                use the Service will immediately cease.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                8. Limitation of Liability
              </h2>
              <p className="text-muted mt-2">
                In no event shall Axel, its officers, directors, employees, or
                agents be liable for any indirect, incidental, special,
                consequential, or punitive damages, including without
                limitation, loss of profits, data, use, goodwill, or other
                intangible losses, resulting from your use of the Service.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                9. Disclaimer of Warranties
              </h2>
              <p className="text-muted mt-2">
                The Service is provided on an "as is" and "as available" basis.
                We make no representations or warranties of any kind, express or
                implied, including but not limited to the warranties of
                merchantability, fitness for a particular purpose, or
                non-infringement.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                10. Indemnification
              </h2>
              <p className="text-muted mt-2">
                You agree to defend, indemnify, and hold harmless Axel and its
                officers, directors, employees, and agents, from and against any
                claims, damages, obligations, losses, liabilities, costs, or
                debt, arising from your use of the Service or violation of these
                Terms.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                11. Governing Law
              </h2>
              <p className="text-muted mt-2">
                These Terms shall be governed by and construed in accordance
                with the laws of the United Kingdom, without regard to its
                conflict of law provisions.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                12. Changes to Terms
              </h2>
              <p className="text-muted mt-2">
                We reserve the right to modify these Terms at any time. We will
                provide notice of material changes by posting the updated Terms
                on this page. Your continued use of the Service after such
                changes constitutes acceptance of the new Terms.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text">
                13. Contact Us
              </h2>
              <p className="text-muted mt-2">
                If you have any questions about these Terms, please contact us
                at support@axel.ai.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <p>© {new Date().getFullYear()} Axel. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-accent transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-accent transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default TermsOfService;
