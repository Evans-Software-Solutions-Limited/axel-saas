/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const stage = input?.stage ?? "dev";
    return {
      name: "axel-saas",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          defaultTags: {
            tags: {
              App: "axel-saas",
              Stage: stage,
            },
          },
        },
      },
    };
  },
  async run() {
    // Storage must be evaluated before api so the api Lambda can link the
    // table — sst infers permissions from the linked component graph.
    await import("./infra/storage");
    const api = await import("./infra/api");
    const web = await import("./infra/web");
    return {
      api: api.coreAPI.url,
      web: $dev ? "http://localhost:5173" : web.frontend.url,
    };
  },
});
