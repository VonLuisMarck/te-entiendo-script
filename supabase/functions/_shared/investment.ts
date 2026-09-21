export type InvestmentInputs = {
  purchase: number;
  acquisitionCosts: number;
  renovation: number;
  furnishing: number;
  loanAmount: number;
  annualRate: number;
  loanYears: number;
  monthlyRent: number;
  vacancyPct: number;
  nonPaymentPct: number;
  annualOperatingCosts: number;
  annualCapexReserve: number;
};
export const investmentFields: Record<keyof InvestmentInputs, string> = {
  purchase: "Precio de compra (€)",
  acquisitionCosts: "Gastos de adquisición (€)",
  renovation: "Reforma (€)",
  furnishing: "Mobiliario (€)",
  loanAmount: "Préstamo (€)",
  annualRate: "Interés nominal anual (%)",
  loanYears: "Plazo del préstamo (años)",
  monthlyRent: "Alquiler mensual supuesto (€)",
  vacancyPct: "Vacancia (%)",
  nonPaymentPct: "Impago sobre renta ocupada (%)",
  annualOperatingCosts: "Gastos operativos anuales (€)",
  annualCapexReserve: "Reserva anual de reposiciones (€)",
};
export function calculateInvestment(x: InvestmentInputs) {
  for (const key of Object.keys(investmentFields) as (keyof InvestmentInputs)[])
    if (
      typeof x[key] !== "number" ||
      !Number.isFinite(x[key]) ||
      x[key] < 0 ||
      x[key] > 100000000
    )
      throw new Error(`Revisa ${investmentFields[key]}`);
  if (
    x.purchase <= 0 ||
    x.vacancyPct > 100 ||
    x.nonPaymentPct > 100 ||
    x.annualRate > 100 ||
    x.loanYears > 50 ||
    (x.loanAmount > 0 && (!Number.isInteger(x.loanYears) || x.loanYears < 1))
  )
    throw new Error("Revisa porcentajes, precio y plazo");
  const totalInvestment =
    x.purchase + x.acquisitionCosts + x.renovation + x.furnishing;
  if (x.loanAmount > totalInvestment)
    throw new Error("El préstamo supera la inversión del escenario");
  const equity = totalInvestment - x.loanAmount,
    monthlyRate = x.annualRate / 1200,
    n = x.loanYears * 12;
  const monthlyDebt =
    x.loanAmount === 0
      ? 0
      : monthlyRate === 0
        ? x.loanAmount / n
        : (x.loanAmount * monthlyRate) /
          -Math.expm1(-n * Math.log1p(monthlyRate));
  const potentialIncome = x.monthlyRent * 12,
    effectiveIncome =
      potentialIncome * (1 - x.vacancyPct / 100) * (1 - x.nonPaymentPct / 100);
  const operatingIncome = effectiveIncome - x.annualOperatingCosts,
    annualDebt = monthlyDebt * 12;
  const cashflow = operatingIncome - annualDebt - x.annualCapexReserve;
  return {
    version: "investment-v1",
    totalInvestment,
    equity,
    monthlyDebt,
    potentialIncome,
    effectiveIncome,
    operatingIncome,
    annualDebt,
    cashflow,
    grossYieldOnPrice: (100 * potentialIncome) / x.purchase,
    netYieldOnTotalCost: (100 * operatingIncome) / totalInvestment,
    cashOnCash: equity > 0 ? (100 * cashflow) / equity : null,
    breakEvenMonthlyRent:
      x.vacancyPct === 100 || x.nonPaymentPct === 100
        ? null
        : (x.annualOperatingCosts + annualDebt + x.annualCapexReserve) /
          (12 * (1 - x.vacancyPct / 100) * (1 - x.nonPaymentPct / 100)),
  };
}
export function investmentSensitivity(x: InvestmentInputs) {
  calculateInvestment(x);
  return [
    { label: "Central", inputs: x },
    {
      label: "Alquiler −10 %",
      inputs: { ...x, monthlyRent: x.monthlyRent * 0.9 },
    },
    {
      label: "Alquiler +10 %",
      inputs: { ...x, monthlyRent: x.monthlyRent * 1.1 },
    },
    {
      label: "Vacancia +5 puntos",
      inputs: { ...x, vacancyPct: x.vacancyPct + 5 },
    },
    {
      label: "Interés +2 puntos",
      inputs: { ...x, annualRate: x.annualRate + 2 },
    },
    {
      label: "Reforma +20 %",
      inputs: { ...x, renovation: x.renovation * 1.2 },
    },
  ].map((s) => {
    try {
      return { ...s, result: calculateInvestment(s.inputs), error: null };
    } catch {
      return { ...s, result: null, error: "Supuesto fuera del rango admitido" };
    }
  });
}
