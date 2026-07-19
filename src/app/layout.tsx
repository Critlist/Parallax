import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parallax",
  description:
    "3D viewer for Graphify (and other node_link_data) graph exports",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
