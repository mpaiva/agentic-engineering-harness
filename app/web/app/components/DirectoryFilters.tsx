import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SearchField,
  Select,
  SelectValue,
} from "react-aria-components";
import type { LocationOption, OrgUnitOption } from "~/lib/contract";

export interface DirectoryFiltersProps {
  orgUnits: OrgUnitOption[];
  locations: LocationOption[];
  defaultQuery?: string;
  defaultOrgUnitId?: string;
  defaultLocationId?: string;
}

// Empty string = "no filter". The loader maps a falsy value back to `undefined`, so an
// empty submitted field simply drops that filter (people.list treats it as unset).
const ALL = "";

/**
 * Employee-directory filter controls, built on React Aria SearchField / ComboBox /
 * Select (stack-recommendation §Directory). Pure and router-free: each control carries a
 * `name` and submits through the enclosing GET form the route wraps around it, so the
 * server loader re-runs people.list with the new params. This keeps the component
 * testable in isolation and keeps filtering server-side.
 *
 * ComboBox (not Select) for org units because there can be dozens — it is type-ahead
 * searchable; Select for the handful of locations.
 */
export function DirectoryFilters({
  orgUnits,
  locations,
  defaultQuery = "",
  defaultOrgUnitId = ALL,
  defaultLocationId = ALL,
}: DirectoryFiltersProps) {
  return (
    <div className="directory-filters">
      <SearchField name="query" defaultValue={defaultQuery} className="field">
        <Label>Search by name or email</Label>
        <Input placeholder="e.g. Rivera" />
      </SearchField>

      <ComboBox
        name="orgUnitId"
        defaultSelectedKey={defaultOrgUnitId || ALL}
        className="field"
        allowsEmptyCollection
        menuTrigger="focus"
      >
        <Label>Org unit</Label>
        <div className="combo-group">
          <Input placeholder="All org units" />
          <Button aria-label="Show org units">▾</Button>
        </div>
        <Popover>
          <ListBox>
            <ListBoxItem id={ALL} textValue="All org units">
              All org units
            </ListBoxItem>
            {orgUnits.map((u) => (
              <ListBoxItem key={u.id} id={u.id} textValue={u.name}>
                {u.name}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </ComboBox>

      <Select
        name="locationId"
        defaultSelectedKey={defaultLocationId || ALL}
        className="field"
      >
        <Label>Location</Label>
        <Button>
          <SelectValue />
          <span aria-hidden="true">▾</span>
        </Button>
        <Popover>
          <ListBox>
            <ListBoxItem id={ALL} textValue="All locations">
              All locations
            </ListBoxItem>
            {locations.map((l) => (
              <ListBoxItem key={l.id} id={l.id} textValue={l.name}>
                {l.name}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>

      <Button type="submit" className="filter-apply">
        Apply filters
      </Button>
    </div>
  );
}

export default DirectoryFilters;
