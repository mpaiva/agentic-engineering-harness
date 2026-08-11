import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Core-HR slice routes. The index redirects to the directory (the slice's entry view).
export default [
  index("routes/home.tsx"),
  route("directory", "routes/directory.tsx"),
  route("org-chart", "routes/org-chart.tsx"),
  route("person/:personId", "routes/person.tsx"),
] satisfies RouteConfig;
