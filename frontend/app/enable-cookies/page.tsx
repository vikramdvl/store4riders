import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, ShieldCheck, CheckCircle2, ExternalLink, Globe, Laptop, Smartphone } from "lucide-react";
import { PolicyPageLayout } from "@/components/layout/PolicyPageLayout";

export const metadata: Metadata = {
  title: "How to Enable Cookies in Your Browser | Store4Riders",
  description:
    "Step-by-step instructions to enable cookies across Chrome, Safari, Firefox, and Edge for a smooth shopping, cart preservation, and secure checkout experience on Store4Riders.",
  alternates: {
    canonical: "/enable-cookies",
  },
};

export default function EnableCookiesPage() {
  return (
    <PolicyPageLayout
      title="How to Enable Cookies"
      subtitle="Follow these simple browser instructions to ensure your shopping cart, login session, and secure checkout operate smoothly on Store4Riders."
      badge="Browser Settings Guide"
      badgeIcon={<Cookie size={14} className="text-brand shrink-0" />}
      lastUpdated="November 2026"
      currentSlug="/enable-cookies"
      summaryAlert={{
        type: "info",
        title: "Why Cookies Are Essential on Store4Riders",
        text: (
          <span>
            Cookies are essential to keep track of items in your shopping bag, maintain secure encrypted sessions, prevent fraudulent bot activity, and ensure seamless RBI-compliant payment processing.
          </span>
        ),
      }}
    >
      <section>
        <h2>1. What are Cookies?</h2>
        <p>
          &ldquo;Cookies&rdquo; are little pieces of data we send when you visit our store. Cookies help us get to know you better and personalize your experience. Plus, they help protect you and other shoppers from fraud.
        </p>
        <p>
          Set your browser to accept cookies so you can buy items, save items to your wishlist, preserve items in your shopping cart across sessions, and receive customized gear recommendations.
        </p>
      </section>

      <section>
        <h2>2. Browser-Specific Instructions to Enable Cookies</h2>
        <p>
          Select your browser below and follow the simple steps to turn on cookies:
        </p>

        {/* Browser Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          {/* Google Chrome */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all shadow-2xs">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                C
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base m-0">Google Chrome</h3>
                <span className="text-xs text-slate-500">Desktop, Android &amp; iOS</span>
              </div>
            </div>
            <ol className="text-sm text-slate-700 space-y-2 pl-4 list-decimal marker:font-bold marker:text-slate-400">
              <li>Click the three vertical dots (<strong>&vellip;</strong>) in the top-right corner and select <strong>Settings</strong>.</li>
              <li>Go to <strong>Privacy and security</strong> &rarr; <strong>Third-party cookies</strong>.</li>
              <li>Select <strong>Allow third-party cookies</strong> or ensure <em>Block third-party cookies</em> is not blocking store functionality.</li>
              <li>Alternatively, add <code className="bg-slate-200 px-1 py-0.5 rounded text-xs font-mono">[*.]store4riders.com</code> under <strong>Sites allowed to use cookies</strong>.</li>
            </ol>
            <div className="mt-4 pt-3 border-t border-slate-200">
              <a
                href="https://support.google.com/accounts/answer/61416?hl=en"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                Official Google Chrome Support Guide <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Apple Safari */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all shadow-2xs">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                S
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base m-0">Apple Safari</h3>
                <span className="text-xs text-slate-500">iPhone, iPad &amp; Mac</span>
              </div>
            </div>
            <ol className="text-sm text-slate-700 space-y-2 pl-4 list-decimal marker:font-bold marker:text-slate-400">
              <li><strong>On iPhone/iPad:</strong> Open iOS <strong>Settings</strong> &rarr; <strong>Safari</strong> &rarr; <strong>Advanced</strong>, and ensure <strong>Block All Cookies</strong> is toggled <strong>OFF</strong>.</li>
              <li><strong>On Mac:</strong> Open Safari, click <strong>Safari</strong> in the top menu &rarr; <strong>Settings</strong> (or <em>Preferences</em>).</li>
              <li>Click the <strong>Privacy</strong> tab.</li>
              <li>Uncheck <strong>Block all cookies</strong> and ensure <em>Prevent cross-site tracking</em> permits necessary session cookies.</li>
            </ol>
            <div className="mt-4 pt-3 border-t border-slate-200">
              <a
                href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                Official Apple Safari Support Guide <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Mozilla Firefox */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all shadow-2xs">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                F
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base m-0">Mozilla Firefox</h3>
                <span className="text-xs text-slate-500">Windows, Mac &amp; Linux</span>
              </div>
            </div>
            <ol className="text-sm text-slate-700 space-y-2 pl-4 list-decimal marker:font-bold marker:text-slate-400">
              <li>Click the menu button (<strong>&equiv;</strong>) in the top-right corner and select <strong>Settings</strong>.</li>
              <li>Select the <strong>Privacy &amp; Security</strong> panel on the left.</li>
              <li>Under <strong>Enhanced Tracking Protection</strong>, select <strong>Standard</strong> (recommended balance of privacy and site functionality).</li>
              <li>If set to <strong>Custom</strong>, ensure <em>Cookies</em> is not set to &ldquo;All cookies&rdquo;.</li>
            </ol>
            <div className="mt-4 pt-3 border-t border-slate-200">
              <a
                href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                Official Mozilla Firefox Support Guide <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Microsoft Edge */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all shadow-2xs">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                E
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base m-0">Microsoft Edge / IE</h3>
                <span className="text-xs text-slate-500">Windows 10/11 &amp; Mac</span>
              </div>
            </div>
            <ol className="text-sm text-slate-700 space-y-2 pl-4 list-decimal marker:font-bold marker:text-slate-400">
              <li>Click the three dots (<strong>&hellip;</strong>) in the top-right corner and open <strong>Settings</strong>.</li>
              <li>Navigate to <strong>Cookies and site permissions</strong> &rarr; <strong>Manage and delete cookies and site data</strong>.</li>
              <li>Switch on <strong>Allow sites to save and read cookie data (recommended)</strong>.</li>
              <li>Ensure <em>Block third-party cookies</em> does not block session verification during checkout.</li>
            </ol>
            <div className="mt-4 pt-3 border-t border-slate-200">
              <a
                href="https://support.microsoft.com/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                Official Microsoft Edge Support Guide <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>3. How Store4Riders Protects Your Privacy</h2>
        <p>
          Store4Riders does not use cookies to sell your browsing habits or monetize personal information. Our cookies serve strictly functional purposes:
        </p>
        <div className="overflow-x-auto my-4">
          <table className="w-full">
            <thead>
              <tr>
                <th>Cookie Role</th>
                <th>Why It Is Required</th>
                <th>Security Standard</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Shopping Cart State</strong></td>
                <td>Remembers your selected helmet sizes, riding jacket choices, and cart quantity when you navigate between pages.</td>
                <td>Strict SameSite, First-Party</td>
              </tr>
              <tr>
                <td><strong>Authentication &amp; Security</strong></td>
                <td>Keeps you signed in safely without exposing passwords. Blacklisted immediately upon logout.</td>
                <td>HttpOnly, Secure, TLS 1.3</td>
              </tr>
              <tr>
                <td><strong>Payment Protection</strong></td>
                <td>Prevents Cross-Site Request Forgery (CSRF) and protects your transactions against bot fraud during bank authorization.</td>
                <td>PCI-DSS Level 1 &amp; RBI Compliant</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>4. Still Having Issues After Enabling Cookies?</h2>
        <p>
          If your browser shows an error while adding items to cart or during payment verification even after enabling cookies, try the following quick fixes:
        </p>
        <ul>
          <li><strong>Refresh with Cache Bypass:</strong> Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono">Ctrl + F5</kbd> (Windows) or <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono">Cmd + Shift + R</kbd> (Mac).</li>
          <li><strong>Clear Site Data:</strong> Clear cookies specifically for <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">store4riders.com</code> and refresh the page.</li>
          <li><strong>Check Incognito / Private Mode:</strong> Open an Incognito window to confirm if a third-party ad-blocker extension is interfering with essential cookies.</li>
        </ul>
        <p className="mt-4">
          For full details on data retention and privacy policies, read our comprehensive{" "}
          <Link href="/privacy" className="font-bold text-blue-600 hover:text-blue-800 underline">
            Privacy and Cookie Policy
          </Link>{" "}
          or reach our support team directly at{" "}
          <a href="mailto:contact@store4riders.com" className="font-bold text-blue-600 hover:text-blue-800 underline">
            contact@store4riders.com
          </a>.
        </p>
      </section>
    </PolicyPageLayout>
  );
}
