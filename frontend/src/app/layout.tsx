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
  title: "Ananta CRM",
  description: "Internal order, quotation, and client management for Ananta Graphics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${plexMono.variable} h-full`}>
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
