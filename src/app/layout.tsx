import type { Metadata } from "next";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "LearnForge",
  description: "Create company-specific e-learning courses and export them to SCORM or xAPI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <UserMenu />
      </body>
    </html>
  );
}
