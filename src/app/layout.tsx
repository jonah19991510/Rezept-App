import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { AuthHashHandler } from "@/components/auth-hash-handler";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// next/font lädt die Schriften beim Build herunter und liefert sie selbst aus,
// im Browser gibt es keine Anfrage an Google.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rezeptbuch",
    template: "%s · Rezeptbuch",
  },
  description: "Rezepte, Makros und Wochenplan für Freunde und Familie.",
  applicationName: "Rezeptbuch",
  // Als App auf dem iPhone-Homebildschirm: eigener Titel, ohne Browserleiste
  appleWebApp: { capable: true, title: "Rezeptbuch", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Keine Indexierung durch Suchmaschinen (zusätzlich X-Robots-Tag-Header und robots.txt)
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1a16" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${inter.variable} ${fraunces.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>
          {children}
          <AuthHashHandler />
          <ServiceWorkerRegister />
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
