import { onRequest as __api___catchall___ts_onRequest } from "C:\\Users\\truck\\TRUCKWITHEASE-1\\functions\\api\\[[catchall]].ts"
import { onRequest as __v1___catchall___ts_onRequest } from "C:\\Users\\truck\\TRUCKWITHEASE-1\\functions\\v1\\[[catchall]].ts"
import { onRequest as __health_ts_onRequest } from "C:\\Users\\truck\\TRUCKWITHEASE-1\\functions\\health.ts"
import { onRequest as __ready_ts_onRequest } from "C:\\Users\\truck\\TRUCKWITHEASE-1\\functions\\ready.ts"

export const routes = [
    {
      routePath: "/api/:catchall*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___catchall___ts_onRequest],
    },
  {
      routePath: "/v1/:catchall*",
      mountPath: "/v1",
      method: "",
      middlewares: [],
      modules: [__v1___catchall___ts_onRequest],
    },
  {
      routePath: "/health",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__health_ts_onRequest],
    },
  {
      routePath: "/ready",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__ready_ts_onRequest],
    },
  ]