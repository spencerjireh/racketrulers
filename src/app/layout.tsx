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
  title: "TourneyHub",
  description: "Multi-sport tournament management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
