import type { Metadata } from "next";
import { Roboto } from "next/font/google";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

import "./globals.css";

export const metadata: Metadata = {
  title: "Helix Webchat Demo",
  description:
    "Sample 3rd-party app: WhatsApp-style support chat wired to a Helix bot over the HTTP API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${roboto.variable} antialiased`}>{children}</body>
    </html>
  );
}
