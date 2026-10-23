import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="app-panel__title">That page isn't here.</h1>
        <p className="app-panel__subtitle">
          If you were visiting a Perch creator's page, double-check the handle in their URL.
        </p>
        <p>
          <Link href="/" className="app-url">
            Back to the start
          </Link>
        </p>
      </div>
    </div>
  );
}
