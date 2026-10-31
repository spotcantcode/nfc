import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <p className="eyebrow">404 / PAGE NOT FOUND</p>
      <h1 className="text-3xl font-semibold">Nothing at this address.</h1>
      <p className="text-muted-foreground">This page may have moved or no longer exists.</p>
      <Link href="/dashboard" className="text-primary underline underline-offset-4">
        Go to your workspace
      </Link>
    </main>
  );
}
