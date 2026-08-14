import type {
  PicodashExactFieldOf,
  PicodashField,
  PicodashFieldOf,
  PicodashJsonValue,
} from '@picodash/nexus'

type IsAny<Value> = 0 extends 1 & Value ? true : false
type SafeField<Field> = IsAny<Field> extends true ? never : Field

export type ScalarField<Value extends PicodashJsonValue> = PicodashFieldOf<Value>
export type ExactField<Value extends PicodashJsonValue> = PicodashExactFieldOf<Value>

export type FieldValue<Field> =
  Field extends PicodashExactFieldOf<infer Value>
    ? Value
    : Field extends PicodashFieldOf<infer Value>
      ? Value
      : never

export type FieldProps<Field> = {
  readonly field: SafeField<Field>
}

export type WritableScalarFieldProps<
  Field extends ScalarField<Output>,
  Output extends PicodashJsonValue,
> = FieldProps<Field> & (Output extends FieldValue<NoInfer<Field>> ? unknown : never)

export type WritableRootField<
  Key extends string,
  Output extends PicodashJsonValue,
  Values extends Record<Key, Output>,
> = Output extends Values[Key] ? PicodashField<Values, Key> : never

export type ChoiceValue = string | number
export type ChoiceField = PicodashFieldOf<string> | PicodashFieldOf<number>
export type ArrayChoiceField =
  | PicodashFieldOf<readonly string[]>
  | PicodashFieldOf<readonly number[]>
export type ArrayChoiceFallbackField =
  | PicodashExactFieldOf<readonly string[]>
  | PicodashExactFieldOf<readonly number[]>

export type ChoiceOptionValue<Field extends ChoiceField, Option extends ChoiceValue> = [
  ChoiceValue,
] extends [Option]
  ? Extract<FieldValue<Field>, ChoiceValue>
  : Option

type CompatibleChoiceField<Field extends ChoiceField, Option extends ChoiceValue> =
  IsAny<Option> extends true
    ? never
    : ChoiceOptionValue<Field, Option> extends FieldValue<Field>
      ? Field
      : never

export type ChoiceFieldProps<Field extends ChoiceField, Option extends ChoiceValue> = FieldProps<
  CompatibleChoiceField<Field, Option>
>

type ArrayChoiceElement<Field extends ArrayChoiceField> =
  FieldValue<Field> extends readonly (infer Element)[] ? Element : never

type CompatibleArrayChoiceField<
  Field extends ArrayChoiceField,
  Option extends ChoiceValue,
> = Field extends ArrayChoiceField
  ? IsAny<Option> extends true
    ? never
    : ArrayChoiceElement<Field>[] extends FieldValue<Field>
      ? ArrayChoiceOptionValue<Field, Option> extends ArrayChoiceElement<Field>
        ? Field
        : never
      : never
  : never

export type ArrayChoiceOptionValue<Field extends ArrayChoiceField, Option extends ChoiceValue> = [
  ChoiceValue,
] extends [Option]
  ? Extract<FieldValue<Field> extends readonly (infer Element)[] ? Element : never, ChoiceValue>
  : Option

export type ArrayChoiceFieldProps<
  Field extends ArrayChoiceField,
  Option extends ChoiceValue,
> = FieldProps<CompatibleArrayChoiceField<Field, Option>>

type ExactCompoundValueMember<Candidate, Expected extends object> = Candidate extends object
  ? Exclude<keyof Candidate, keyof Expected> extends never
    ? Exclude<keyof Expected, keyof Candidate> extends never
      ? Candidate extends Expected
        ? Expected extends Candidate
          ? true
          : false
        : false
      : false
    : false
  : false

type IsExactCompoundValue<Candidate, Expected extends object> =
  IsAny<Candidate> extends true
    ? false
    : [Candidate] extends [never]
      ? false
      : false extends (
            Candidate extends unknown ? ExactCompoundValueMember<Candidate, Expected> : never
          )
        ? false
        : true

type CompatibleExactField<
  Field extends ScalarField<PicodashJsonValue>,
  Expected extends PicodashJsonValue & object,
> = IsExactCompoundValue<FieldValue<Field>, Expected> extends true ? Field : never

export type ExactCompoundFieldProps<
  Field extends ScalarField<PicodashJsonValue>,
  Expected extends PicodashJsonValue & object,
> = FieldProps<CompatibleExactField<Field, Expected>>

type DashletBindingField = PicodashField<Record<string, PicodashJsonValue>, string>

/** Bridges a type-only value view back to the public Dashlet shell's nominal field handle. */
export function asDashletBindingField(
  field: PicodashFieldOf<PicodashJsonValue>,
): DashletBindingField {
  return field as unknown as DashletBindingField
}
