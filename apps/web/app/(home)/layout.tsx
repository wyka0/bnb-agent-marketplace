import { HomeNav } from "@/components/home/home-nav";
import { HomeFooter } from "@/components/home/home-footer";
import { ThemeProvider } from "@/components/theme-provider";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <div className="flex min-h-screen flex-col">
        <HomeNav />
        <main className="flex-1">{children}</main>
        <HomeFooter />
      </div>
    </ThemeProvider>
  );
}
