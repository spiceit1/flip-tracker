import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-white/10 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-6 h-14">
            <Link href="/flips" className="font-semibold text-lg text-white">
              Flip Tracker
            </Link>
            <Link href="/flips" className="text-gray-400 hover:text-white transition-colors">
              Flips
            </Link>
            <Link href="/deals" className="text-gray-400 hover:text-white transition-colors">
              Deals
            </Link>
            <Link href="/scanner-rules" className="text-gray-400 hover:text-white transition-colors">
              Rules
            </Link>
          </div>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
