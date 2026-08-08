import type { Metadata, Viewport } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gratinata - Inventario",
  description: "Inventario y pedidos de Gratinata Pizza",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gratinata",
  },
};

export const viewport: Viewport = {
  themeColor: "#efe9dc",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const NO_FOUC_THEME_SCRIPT = `
try {
  var t = localStorage.getItem("gratinata_theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${spaceMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
