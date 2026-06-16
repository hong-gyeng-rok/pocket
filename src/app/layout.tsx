"use client";

import "./globals.css";
import { Providers } from "./providers";
import Sidebar from "@component/sidebar/Sidebar";
import { useState } from "react";
import { Menu } from "lucide-react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <html lang="en">
      <body className="antialiased flex h-screen overflow-hidden">
        <Providers>
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
          <main className="flex-1 relative overflow-hidden">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden absolute top-4 left-4 z-10 grid min-h-11 min-w-11 place-items-center rounded-full border border-stone-200 bg-white/80 shadow-sm backdrop-blur-sm hover:bg-white"
              aria-label="Open sidebar"
            >
              <Menu size={24} />
            </button>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
