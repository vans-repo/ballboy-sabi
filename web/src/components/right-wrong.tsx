/** ✓ or ✗ for the Ballboy's most likely result against the real one. */
export function RightWrong({ right }: { right: boolean }) {
  return right ? (
    <span className="font-bold text-success">
      <span aria-hidden="true">✓</span>
      <span className="sr-only">The Ballboy&apos;s most likely result was right</span>
    </span>
  ) : (
    <span className="font-bold text-danger">
      <span aria-hidden="true">✗</span>
      <span className="sr-only">The Ballboy&apos;s most likely result was wrong</span>
    </span>
  );
}
