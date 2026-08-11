import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { PersonView } from "~/components/PersonView";
import { renderWithRouter } from "./helpers";
import { personDetail, personDetailNoManager } from "./fixtures";

describe("PersonView", () => {
  it("renders the person's name as the single h1", () => {
    renderWithRouter(<PersonView detail={personDetail} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Carmen Adams");
  });

  it("links to the manager's profile", () => {
    renderWithRouter(<PersonView detail={personDetail} />);
    const dl = screen.getByText("Manager").closest("div")!;
    const link = within(dl).getByRole("link", { name: "Bruno Chen" });
    expect(link).toHaveAttribute("href", "/person/PER-000002");
  });

  it("lists direct reports with links", () => {
    renderWithRouter(<PersonView detail={personDetail} />);
    const reports = screen.getByRole("region", { name: /Direct reports/i });
    expect(within(reports).getByRole("link", { name: "Dev Kapoor" })).toHaveAttribute(
      "href",
      "/person/PER-000010",
    );
    expect(within(reports).getByRole("link", { name: "Elin Vasquez" })).toBeInTheDocument();
  });

  it("renders the reporting chain ROOT→person with the person marked aria-current", () => {
    renderWithRouter(<PersonView detail={personDetail} />);
    const nav = screen.getByRole("navigation", { name: "Reporting chain" });
    const items = within(nav).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // First crumb is the root (a link), last crumb is the current person (not a link).
    expect(within(items[0]).getByRole("link", { name: "Ada Rivera" })).toBeInTheDocument();
    const current = within(nav).getByText("Carmen Adams");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(within(items[2]).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a 'top of the reporting line' note when there is no manager", () => {
    renderWithRouter(<PersonView detail={personDetailNoManager} />);
    const dl = screen.getByText("Manager").closest("div")!;
    expect(within(dl).getByText(/top of the reporting line/i)).toBeInTheDocument();
    expect(within(dl).queryByRole("link")).not.toBeInTheDocument();
  });

  it("links into the org chart focused on the person's seat", () => {
    renderWithRouter(<PersonView detail={personDetail} />);
    const link = screen.getByRole("link", { name: /View Carmen Adams in the org chart/i });
    expect(link).toHaveAttribute("href", "/org-chart?focus=POS-000003");
  });
});
