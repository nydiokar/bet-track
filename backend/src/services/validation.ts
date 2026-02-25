type ValidationIssue = { field: string; message: string };

export type ValidationResult = {
  issues: ValidationIssue[];
};

export const validateExtraction = (raw: Record<string, unknown>): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (typeof raw.odds === "number" && raw.kind === "parlay" && Array.isArray(raw.legs)) {
    const product = (raw.legs as Array<{ odds?: number }>).reduce(
      (acc, leg) => acc * (typeof leg.odds === "number" ? leg.odds : 1),
      1
    );
    const diff = Math.abs(product - (raw.odds as number));
    if (diff > 0.05 * (raw.odds as number)) {
      issues.push({
        field: "odds",
        message: `Combined odds ${raw.odds} don't match leg product ${product.toFixed(2)}`,
      });
    }
  }

  if (raw.kind === "parlay" && (!Array.isArray(raw.legs) || (raw.legs as unknown[]).length < 2)) {
    issues.push({ field: "legs", message: "Parlay must have at least 2 legs" });
  }

  return { issues };
};
