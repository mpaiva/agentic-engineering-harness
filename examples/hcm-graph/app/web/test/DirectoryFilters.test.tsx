import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectoryFilters } from "~/components/DirectoryFilters";
import { locationOptions, orgUnitOptions } from "./fixtures";

function renderFilters(props?: Partial<Parameters<typeof DirectoryFilters>[0]>) {
  return render(
    <form aria-label="filters">
      <DirectoryFilters orgUnits={orgUnitOptions} locations={locationOptions} {...props} />
    </form>,
  );
}

describe("DirectoryFilters", () => {
  it("renders an accessible search field, org-unit combobox, and location select", () => {
    renderFilters();
    expect(screen.getByRole("searchbox", { name: /Search by name or email/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Org unit/i })).toBeInTheDocument();
    // React Aria Select exposes a button with role button labelled by its Label.
    expect(screen.getByRole("button", { name: /Location/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply filters/i })).toBeInTheDocument();
  });

  it("seeds the search field from the current query", () => {
    renderFilters({ defaultQuery: "Rivera" });
    expect(screen.getByRole("searchbox", { name: /Search/i })).toHaveValue("Rivera");
  });

  it("submits the chosen org unit as a hidden form value the loader reads", async () => {
    const user = userEvent.setup();
    const { container } = renderFilters();
    const combo = screen.getByRole("combobox", { name: /Org unit/i });
    await user.click(combo);
    await user.click(await screen.findByRole("option", { name: "Engineering" }));
    // React Aria mirrors the selection into a hidden form control named orgUnitId.
    const hidden = container.querySelector('[name="orgUnitId"]') as HTMLInputElement | HTMLSelectElement;
    expect(hidden).toBeTruthy();
    expect(hidden.value).toBe("OU-000002");
  });

  it("offers an 'All' escape option in each filter", async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByRole("combobox", { name: /Org unit/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "All org units" })).toBeInTheDocument();
  });

  it("lists every provided location in the select", async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByRole("button", { name: /Location/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "Berlin Office" })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: "San Francisco" })).toBeInTheDocument();
  });
});
