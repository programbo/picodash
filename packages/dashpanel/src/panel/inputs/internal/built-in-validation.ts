export type DistributiveOmit<TValue, TKeys extends PropertyKey> = TValue extends unknown
  ? Omit<TValue, Extract<keyof TValue, TKeys>>
  : never
