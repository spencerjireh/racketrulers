import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "RacketRulers",
    template: "%s | RacketRulers",
  },
  description: "RacketRulers -- the all-in-one badminton tournament management and coaching platform",
  openGraph: {
    title: "RacketRulers",
    description: "RacketRulers -- the all-in-one badminton tournament management and coaching platform",
    images: [{ url: "/logo.png", width: 800, height: 800 }],
  },
  twitter: {
    card: "summary",
    title: "RacketRulers",
    description: "RacketRulers -- the all-in-one badminton tournament management and coaching platform",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.className} ${outfit.variable} antialiased`}>
        <TRPCReactProvider>
          <AuthSessionProvider>
            {children}
            <Toaster />
          </AuthSessionProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
