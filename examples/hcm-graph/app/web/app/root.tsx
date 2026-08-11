import {
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import type { LinksFunction } from "react-router";
import appStylesHref from "./styles/app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appStylesHref },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {/* WCAG 2.2 AA: a bypass block to the primary content (2.4.1). */}
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <header className="app-header">
          <p className="app-brand">HCM Graph — Core HR</p>
          <nav aria-label="Primary">
            <ul className="app-nav">
              <li>
                <NavLink to="/directory">Directory</NavLink>
              </li>
              <li>
                <NavLink to="/org-chart">Org chart</NavLink>
              </li>
            </ul>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  let title = "Something went wrong";
  let detail = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    detail =
      error.status === 404
        ? "We could not find what you were looking for."
        : (typeof error.data === "string" && error.data) || detail;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <section aria-labelledby="error-heading" className="error-panel">
      <h1 id="error-heading">{title}</h1>
      <p>{detail}</p>
      <p>
        <a href="/directory">Return to the directory</a>
      </p>
    </section>
  );
}
