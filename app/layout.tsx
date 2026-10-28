import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prep Tracker",
  description: "Tracks placement preparation from a Google Sheet and runs AI mock interviews.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
