import type {
  ChartNode,
  DirectoryRow,
  LocationOption,
  OrgUnitOption,
  PersonDetail,
} from "~/lib/contract";

export const directoryRows: DirectoryRow[] = [
  {
    personId: "PER-000001",
    firstName: "Ada",
    lastName: "Rivera",
    email: "ada.rivera@example.com",
    status: "active",
    positionId: "POS-000001",
    positionTitle: "Chief Executive Officer",
    orgUnitId: "OU-000001",
    orgUnitName: "Acme Corp",
    locationId: "LOC-001",
    locationName: "San Francisco",
  },
  {
    personId: "PER-000002",
    firstName: "Bruno",
    lastName: "Chen",
    email: "bruno.chen@example.com",
    status: "active",
    positionId: "POS-000002",
    positionTitle: "VP Engineering",
    orgUnitId: "OU-000002",
    orgUnitName: "Engineering",
    locationId: "LOC-002",
    locationName: "Berlin",
  },
  {
    personId: "PER-000003",
    firstName: "Carmen",
    lastName: "Adams",
    email: "carmen.adams@example.com",
    status: "leave",
    positionId: "POS-000003",
    positionTitle: "Staff Engineer",
    orgUnitId: "OU-000002",
    orgUnitName: "Engineering",
    locationId: "LOC-002",
    locationName: "Berlin",
  },
];

export const personDetail: PersonDetail = {
  person: {
    id: "PER-000003",
    firstName: "Carmen",
    lastName: "Adams",
    email: "carmen.adams@example.com",
    status: "active",
    hireDate: "2021-03-15",
  },
  position: {
    id: "POS-000003",
    title: "Staff Engineer",
    level: 5,
    fte: 1,
    status: "filled",
  },
  job: { id: "JOB-007", title: "Software Engineer", family: "Engineering", level: 5 },
  orgUnit: { id: "OU-000002", name: "Platform Engineering", type: "department" },
  location: {
    id: "LOC-002",
    name: "Berlin Office",
    city: "Berlin",
    country: "Germany",
    timezone: "Europe/Berlin",
  },
  managerPersonId: "PER-000002",
  managerName: "Bruno Chen",
  directReports: [
    { personId: "PER-000010", name: "Dev Kapoor", positionId: "POS-000010", positionTitle: "Engineer" },
    { personId: "PER-000011", name: "Elin Vasquez", positionId: "POS-000011", positionTitle: "Engineer" },
  ],
  // ROOT → this person (breadcrumb order).
  reportingChain: [
    { personId: "PER-000001", name: "Ada Rivera", positionId: "POS-000001", positionTitle: "CEO" },
    { personId: "PER-000002", name: "Bruno Chen", positionId: "POS-000002", positionTitle: "VP Engineering" },
    { personId: "PER-000003", name: "Carmen Adams", positionId: "POS-000003", positionTitle: "Staff Engineer" },
  ],
};

export const personDetailNoManager: PersonDetail = {
  ...personDetail,
  person: { ...personDetail.person, id: "PER-000001", firstName: "Ada", lastName: "Rivera" },
  position: { ...personDetail.position!, id: "POS-000001", title: "Chief Executive Officer" },
  managerPersonId: null,
  managerName: null,
  directReports: [
    { personId: "PER-000002", name: "Bruno Chen", positionId: "POS-000002", positionTitle: "VP Engineering" },
  ],
  reportingChain: [
    { personId: "PER-000001", name: "Ada Rivera", positionId: "POS-000001", positionTitle: "CEO" },
  ],
};

export const orgChart: ChartNode = {
  positionId: "POS-000001",
  title: "Chief Executive Officer",
  holderPersonId: "PER-000001",
  holderName: "Ada Rivera",
  orgUnitId: "OU-000001",
  orgUnitName: "Acme Corp",
  spanOfControl: 2,
  level: 1,
  children: [
    {
      positionId: "POS-000002",
      title: "VP Engineering",
      holderPersonId: "PER-000002",
      holderName: "Bruno Chen",
      orgUnitId: "OU-000002",
      orgUnitName: "Engineering",
      spanOfControl: 1,
      level: 2,
      children: [
        {
          positionId: "POS-000003",
          title: "Staff Engineer",
          holderPersonId: "PER-000003",
          holderName: "Carmen Adams",
          orgUnitId: "OU-000002",
          orgUnitName: "Platform Engineering",
          spanOfControl: 0,
          level: 3,
          children: [],
        },
      ],
    },
    {
      positionId: "POS-000004",
      title: "VP Sales",
      // Open seat: no current holder (HOLDS to IS NULL absent).
      holderPersonId: null,
      holderName: null,
      orgUnitId: "OU-000003",
      orgUnitName: "Sales",
      spanOfControl: 0,
      level: 2,
      children: [],
    },
  ],
};

export const orgUnitOptions: OrgUnitOption[] = [
  { id: "OU-000001", name: "Acme Corp", type: "company", parentId: null },
  { id: "OU-000002", name: "Engineering", type: "division", parentId: "OU-000001" },
  { id: "OU-000003", name: "Sales", type: "division", parentId: "OU-000001" },
];

export const locationOptions: LocationOption[] = [
  { id: "LOC-001", name: "San Francisco", city: "San Francisco", country: "USA", timezone: "America/Los_Angeles" },
  { id: "LOC-002", name: "Berlin Office", city: "Berlin", country: "Germany", timezone: "Europe/Berlin" },
];
