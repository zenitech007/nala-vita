export type TemperatureUnit = "C" | "F";
const precise = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export function temperatureToCelsius(value: number, unit: TemperatureUnit): number {
  return precise(unit === "F" ? (value - 32) * 5 / 9 : value);
}
export function temperatureFromCelsius(value: number, unit: TemperatureUnit): number {
  return precise(unit === "F" ? value * 9 / 5 + 32 : value);
}
export function formatTemperature(value: number, unit: TemperatureUnit = "C"): string {
  return `${temperatureFromCelsius(value, unit).toFixed(1)}°${unit}`;
}
// Existing application thresholds, expressed in one canonical unit.
export const TEMPERATURE = {
  normalMinC: temperatureToCelsius(97, "F"), normalMaxC: temperatureToCelsius(99.5, "F"),
  feverC: 38.5, criticalC: 39.5,
};
export const TEMPERATURE_RANGE_F = {
  min: temperatureFromCelsius(TEMPERATURE.normalMinC, "F"),
  max: temperatureFromCelsius(TEMPERATURE.normalMaxC, "F"),
};
