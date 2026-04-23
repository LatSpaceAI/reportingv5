import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "LatSpace — CBAM Communication Template",
  description:
    "Interactive interface for the CBAM Communication Template for Installations (v2.1.1).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
