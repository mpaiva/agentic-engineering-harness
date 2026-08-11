import { data } from "react-router";
import type { Route } from "./+types/person";
import { getApi } from "~/lib/trpc.server";
import { PersonView } from "~/components/PersonView";
import type { PersonDetail } from "~/lib/contract";

export function meta({ data: loaded }: Route.MetaArgs) {
  const name = loaded
    ? `${loaded.detail.person.firstName} ${loaded.detail.person.lastName}`
    : "Person";
  return [{ title: `${name} — HCM Graph` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const detail: PersonDetail | null = await getApi()
    .people.get.query({ personId: params.personId })
    .catch(() => null);

  if (!detail) {
    throw data(`No person with id ${params.personId}.`, { status: 404 });
  }
  return { detail };
}

export default function Person({ loaderData }: Route.ComponentProps) {
  return <PersonView detail={loaderData.detail} />;
}
