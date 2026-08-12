import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { Providers } from "./providers";
import { ThemeProvider } from "./theme-provider";
import { ToastProvider } from "./toast-provider";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <ToastProvider>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <TopNav />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1">{children}</main>
            </div>
            <Footer />
          </div>
        </Providers>
      </ToastProvider>
    </ThemeProvider>
  );
}
