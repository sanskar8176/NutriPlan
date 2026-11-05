import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "@/components/ui/auth-provider";
import { Navbar } from "@/components/ui/navbar";
import { Analytics } from "@vercel/analytics/next";

// Fonts are downloaded at build time and served from this origin — no runtime
// request to Google Fonts, no layout shift, and a tighter Content-Security-Policy.
const heading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NutriPlan — Personalized Meal Planning",
  description: "Get a science-backed calorie and macro plan tailored to your body and goals.",
  keywords: ["diet planner", "meal plan", "calorie calculator", "macro tracker"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${heading.variable} ${body.variable}`}>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <Navbar />
            <main>{children}</main>
          </ThemeProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
