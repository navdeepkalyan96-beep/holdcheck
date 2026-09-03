import type { Metadata } from "next";
import Nav from "./components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "HoldCheck — net rupees if you exit now",
  description:
    "For Indian retail Nifty option traders. See net-if-exited-now after charges and theta, and whether the required move is what the market is actually pricing. Estimates only, not investment advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0C0E10] text-[#EDEEF0]">
        <Nav />
        {children}
      </body>
    </html>
  );
}
