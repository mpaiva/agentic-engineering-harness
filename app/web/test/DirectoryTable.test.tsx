import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectoryTable } from "~/components/DirectoryTable";
import { renderWithRouter } from "./helpers";
import { directoryRows } from "./fixtures";

describe("DirectoryTable", () => {
  it("renders a semantic table with a caption and column headers", () => {
    renderWithRouter(<DirectoryTable rows={directoryRows} caption="Employees — 3" />);
    const table = screen.getByRole("table", { name: /Employees — 3/i });
    expect(table).toBeInTheDocument();
    expect(within(table).getByText("Employees — 3")).toBeInTheDocument(); // <caption>
    for (const header of ["Name", "Email", "Status", "Position", "Org unit", "Location"]) {
      expect(screen.getByRole("columnheader", { name: new RegExp(header) })).toBeInTheDocument();
    }
  });

  it("links each person's name to their detail route", () => {
    renderWithRouter(<DirectoryTable rows={directoryRows} caption="Employees" />);
    const link = screen.getByRole("link", { name: "Ada Rivera" });
    expect(link).toHaveAttribute("href", "/person/PER-000001");
  });

  it("defaults to ascending sort by name and exposes aria-sort", () => {
    renderWithRouter(<DirectoryTable rows={directoryRows} caption="Employees" />);
    const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    // Row headers (person names) are <th scope="row">; first data row sorts to "Adams".
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders[0]).toHaveTextContent("Carmen Adams");
  });

  it("toggles to descending when the active sort header is activated", async () => {
    const user = userEvent.setup();
    renderWithRouter(<DirectoryTable rows={directoryRows} caption="Employees" />);
    await user.click(screen.getByRole("button", { name: /Name/ }));
    const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders[0]).toHaveTextContent("Ada Rivera");
  });

  it("sorts by another column when its header is chosen", async () => {
    const user = userEvent.setup();
    renderWithRouter(<DirectoryTable rows={directoryRows} caption="Employees" />);
    await user.click(screen.getByRole("button", { name: /Status/ }));
    expect(screen.getByRole("columnheader", { name: /Status/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    // active < leave alphabetically → an active person's row sorts first.
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders[rowHeaders.length - 1]).toHaveTextContent("Carmen Adams"); // leave, last
  });

  it("shows an empty-state status message when there are no rows", () => {
    renderWithRouter(<DirectoryTable rows={[]} caption="Employees" />);
    expect(screen.getByRole("status")).toHaveTextContent(/No employees match/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
