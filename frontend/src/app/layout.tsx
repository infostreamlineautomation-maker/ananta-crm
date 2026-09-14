import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { OrganizationProvider } from "@/lib/organization-context";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AnantaGraphics x MeewaIndustries CRM",
  description: "Enterprise Order, Quotation, and Client Management System.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${plexMono.variable} h-full`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var orgName = localStorage.getItem('crm_active_org_name');
                var orgLogo = localStorage.getItem('crm_active_org_logo');
                if (orgName) {
                  document.title = orgName.toLowerCase().includes('crm') ? orgName : (orgName + ' CRM');
                }
                if (orgLogo) {
                  var link = document.querySelector("link[rel*='icon']");
                  if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.head.appendChild(link);
                  }
                  link.href = orgLogo;
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="h-full antialiased">
        <ToastProvider>
          <AuthProvider>
            <OrganizationProvider>{children}</OrganizationProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
