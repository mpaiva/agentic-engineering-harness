/**
 * `people.*` — the directory and the person view.
 *
 * Both procedures validate input with zod and re-validate their result with an
 * output schema, so the wire contract is enforced at runtime. They are thin:
 * all shaping lives in the repository, which returns the DTOs these schemas
 * describe.
 */
import { router, publicProcedure } from "../trpc.js";
import {
  directoryPageSchema,
  peopleListInput,
  personDetailSchema,
  personIdInput,
} from "../schemas.js";

export const peopleRouter = router({
  /** Cursor-paginated directory with name/orgUnit/location filters. */
  list: publicProcedure
    .input(peopleListInput)
    .output(directoryPageSchema)
    .query(({ input, ctx }) => ctx.repo.listPeople(input)),

  /** One person: seat, job, org unit, location, manager, reports, chain. */
  get: publicProcedure
    .input(personIdInput)
    .output(personDetailSchema.nullable())
    .query(({ input, ctx }) => ctx.repo.getPerson(input.personId)),
});
