const msPerDay = 86_400_000
/** The average month, as the WHO growth standards count it. */
const daysPerMonth = 30.4375
const daysPerWeek = 7
/** A term pregnancy, in completed weeks, for correcting prematurity. */
const termWeeks = 40

/** Age in months between two dates, as the WHO standards count it. */
export function ageInMonths(birth: Date, measured: Date) {
  return (measured.getTime() - birth.getTime()) / msPerDay / daysPerMonth
}

/** Age in completed years on a date, as a birthday counts it. */
export function ageInYears(birth: Date, on: Date) {
  const years = on.getUTCFullYear() - birth.getUTCFullYear()
  const birthdayPassed =
    on.getUTCMonth() > birth.getUTCMonth() ||
    (on.getUTCMonth() === birth.getUTCMonth() &&
      on.getUTCDate() >= birth.getUTCDate())
  return birthdayPassed ? years : years - 1
}

/**
 * Age in months corrected for prematurity: chronological age less the weeks
 * born before term. Growth charts use it for babies born before 37 weeks,
 * usually until 24 months. Never below zero.
 */
export function correctedAgeInMonths(
  birth: Date,
  measured: Date,
  gestationalWeeks: number
) {
  const earlyDays = Math.max(0, termWeeks - gestationalWeeks) * daysPerWeek
  return Math.max(0, ageInMonths(birth, measured) - earlyDays / daysPerMonth)
}

/** Formats an age in months, such as "9.5 months" or "3 y 2 mo". */
export function formatAge(ageMonths: number) {
  const months = Math.round(ageMonths * 10) / 10
  if (months < 24) return `${months} ${months === 1 ? "month" : "months"}`
  const years = Math.floor(months / 12)
  const rest = Math.round((months - years * 12) * 10) / 10
  return rest ? `${years} y ${rest} mo` : `${years} years`
}
