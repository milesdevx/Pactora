import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-8 max-w-md w-full shadow-2xl">
        <span className="text-xs font-mono text-teal-400 font-semibold uppercase tracking-wider">
          404 Not Found
        </span>
        <h1 className="text-2xl font-bold text-white mt-2">Page Not Found</h1>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          The escrow agreement, receipt, or resource you are looking for does not exist or has been moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/">
            <Button size="sm" variant="outline">
              Home
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm">
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

