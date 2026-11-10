import { createApi } from "../../server/app";
import { netlifyContext } from "../../server/runtime";

export default async (req: Request): Promise<Response> => createApi(netlifyContext())(req);

export const config = { path: "/api/*" };
