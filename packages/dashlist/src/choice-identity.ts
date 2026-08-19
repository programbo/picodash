export type ChoiceIdentityValue = string | number

export function choiceKey(value: ChoiceIdentityValue): string {
  return `${typeof value}:${String(value)}`
}

export function sameChoiceValue(left: ChoiceIdentityValue, right: ChoiceIdentityValue): boolean {
  return choiceKey(left) === choiceKey(right)
}
