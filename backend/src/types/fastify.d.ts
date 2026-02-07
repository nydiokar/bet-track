import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { actor: string };
    user: { actor: string };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    actor: string;
  }
}