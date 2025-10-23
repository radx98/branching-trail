import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Branching Trail",
  description:
    "Brainstorm branching ideas by exploring AI-generated prompts and custom refinements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
