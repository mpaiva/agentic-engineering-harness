import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";

/**
 * Render a component that uses <Link>/router hooks inside a MemoryRouter so component
 * tests stay isolated from loaders and the tRPC server (which the integration + e2e
 * suites cover against a real Neo4j).
 */
export function renderWithRouter(ui: ReactElement, initialEntries: string[] = ["/"]) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}
