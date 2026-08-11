import { redirect } from "react-router";

// The Core-HR slice opens on the employee directory.
export function loader() {
  return redirect("/directory");
}
