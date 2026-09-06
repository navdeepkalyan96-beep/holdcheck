import type { Metadata } from "next";
import Nav from "./components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "HoldCheck — know when to hold",
  description:
    "Live net P&L after charges for Nifty options. Hold hygiene, not another option chain.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#07051a] text-[#F4F5F8]">
        <Nav />
        {children}
      </body>
    </html>
  );
}
