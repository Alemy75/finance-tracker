// Dependency injection container, ported from @mfa/container (mfa repository, libs/container).

/* eslint-disable @typescript-eslint/no-explicit-any -- generic container plumbing */
type AnyFunction = (...args: any[]) => any;
type ToInstances<T> = {
  [K in keyof T]: T[K] extends AnyFunction ? ReturnType<T[K]> : never;
} & {};

type Prettify<T> = { [K in keyof T]: T[K] } & {};

export interface ContainerBuilder<TExistingDeps, TRequires> {
  require: <TNewRequires extends Record<string, any>>(
    newRequires: TNewRequires
  ) => ContainerBuilder<Prettify<TExistingDeps & TNewRequires>, Prettify<TRequires & TNewRequires>>;
  provide: <TNewDeps extends Record<string, (di: TExistingDeps) => unknown>>(
    newDeps: TNewDeps
  ) => ContainerBuilder<Prettify<TExistingDeps & ToInstances<TNewDeps>>, Prettify<Omit<TRequires, keyof TNewDeps>>>;
  override: (newDeps: {
    [K in keyof TExistingDeps]?: (di: Omit<TExistingDeps, K>) => TExistingDeps[K];
  }) => ContainerBuilder<TExistingDeps, TRequires>;
  build: (...requires: TRequires extends Record<string, never> ? [] : [requires: TRequires]) => TExistingDeps;
}

export type ContainerOf<T> = T extends ContainerBuilder<infer Deps, any> ? Deps : never;
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Declares the type of a required dependency; at runtime it is not used for anything. */
export function type<T>() {
  return undefined as T;
}

/** A symbol avoids clashing with a service a user might call `__instances`. */
const instancesKey = Symbol("__instances");

/**
 * Services are created lazily on first access and cached; `override` replaces factories (for example in tests).
 *
 * @example
 *  const di = createContainer()
 *    .require({ config: type<Config>() })
 *    .provide({ httpClient: ({ config }) => createHttpClient(config.baseUrl) })
 *    .provide({ getPosts: ({ httpClient }) => () => httpClient.get("/posts") })
 *    .build({ config: myConfig });
 */
export function createContainer(): ContainerBuilder<{}, {}> {
  const builder = {
    layers: [] as Record<string, (di: unknown) => unknown>[],
    requires: [] as Record<string, unknown>[],
    require(requireObj: Record<string, unknown>) {
      this.requires.push(requireObj);
      return this;
    },
    provide(layerObj: Record<string, (di: unknown) => unknown>) {
      this.layers.push(layerObj);
      for (const serviceName in layerObj) {
        if (typeof layerObj[serviceName] !== "function") console.error(`[DI] Provided ${serviceName} factory is not a function`);
      }
      return this;
    },
    override(overrideObj: Record<string, (di: unknown) => unknown>) {
      return this.provide(overrideObj);
    },
    build(requires: object | undefined = {}) {
      const di = { ...requires, [instancesKey]: {} as Record<string, unknown> };
      const notProvidedServices = new Set(this.requires.flatMap((r) => Object.keys(r)));
      for (const service in di) notProvidedServices.delete(service);

      for (const layer of this.layers) {
        for (const serviceName in layer) {
          Object.defineProperty(di, serviceName, {
            get() {
              const existingInstances = (this as typeof di)[instancesKey];
              return (existingInstances[serviceName] ??= layer[serviceName]?.(di));
            },
            configurable: true // lets a later layer or override replace the service
          });
          notProvidedServices.delete(serviceName);
        }
      }

      if (notProvidedServices.size !== 0) {
        console.error(`[DI] Services without implementation: ${Array.from(notProvidedServices).join(",")}`);
      }
      return di;
    }
  };

  return builder as unknown as ContainerBuilder<{}, {}>;
}
