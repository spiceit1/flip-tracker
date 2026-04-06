import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flip Tracker",
  description: "Ticket arbitrage tracking system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">
        {children}
      </body>
    </html>
  );
}
