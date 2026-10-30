import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "./SiteHeader";
import { themeScript } from "./themeScript";

export const metadata: Metadata = {
  title: "Prep Tracker",
  description: "Tracks placement preparation from a Google Sheet and quizzes you on each study guide you finish.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
