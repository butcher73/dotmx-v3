import { Header, Footer } from "@/components/common";

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function Layout({ children, className = "" }: LayoutProps) {
  return (
    <div className={`min-h-screen bg-black text-white ${className}`}>
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
