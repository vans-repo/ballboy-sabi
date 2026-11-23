import Link from "next/link";

import { PageTitle } from "@/components/section";

export default function NotFound() {
  return (
    <>
      <PageTitle>Page not found</PageTitle>
      <p>
        This page doesn&apos;t exist.{" "}
        <Link href="/" className="text-ink underline underline-offset-2">
          Go to the home page
        </Link>
        .
      </p>
    </>
  );
}
