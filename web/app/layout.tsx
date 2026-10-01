import type { Metadata } from "next";
import { SessionProvider } from "@/components/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Hunt HQ",
  description: "Turn opportunities into outcomes.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
