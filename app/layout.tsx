import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "@/components/ui/auth-provider";
import { Navbar } from "@/components/ui/navbar";

export const metadata: Metadata = {
  title: "NutriPlan — Personalized Meal Planning",
  description: "Get a science-backed calorie and macro plan tailored to your body and goals.",
  keywords: ["diet planner", "meal plan", "calorie calculator", "macro tracker"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <Navbar />
            <main>{children}</main>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
