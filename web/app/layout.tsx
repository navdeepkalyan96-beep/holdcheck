import type { Metadata } from "next";
import Nav from "./components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "HoldCheck — trade management for options",
  description:
    "Hold or exit the open Nifty option with a live state: Safe, At risk, Dead. Estimates only, not advice.",
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
