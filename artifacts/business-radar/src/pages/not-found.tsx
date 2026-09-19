import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex w-full mt-20 flex-col items-center justify-center p-4">
      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
      <p className="text-muted-foreground mb-6 max-w-md text-center">
        The system or record you are trying to access does not exist or you do not have permission to view it.
      </p>
      <Link href="/" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
        Return to Overview
      </Link>
    </div>
  );
}
