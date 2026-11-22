type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

interface UnitNames {
  step: PluralForms
  second: PluralForms
  shortSeconds: string
  shortMilliseconds: string
}

export function createFormatters(locale: string, units: UnitNames) {
  const integers = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const percentages = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })
  const plurals = new Intl.PluralRules(locale)

  function unit(value: number, forms: PluralForms): string {
    return ` ${forms[plurals.select(value)] ?? forms.other}`
  }

  return {
    number: (value: number) => integers.format(value),
    percent: (value: number) => percentages.format(value),
    milliseconds: (value: number) => `${integers.format(value)} ${units.shortMilliseconds}`,
    seconds: (ms: number) => `${integers.format(ms / 1000)} ${units.shortSeconds}`,
    stepUnit: (count: number) => unit(count, units.step),
    secondUnit: (count: number) => unit(count, units.second),
  }
}
