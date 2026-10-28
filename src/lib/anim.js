export const clamp = (x) => Math.max(0, Math.min(1, x));
export const lerp = (a, b, f) => a + (b - a) * f;
export const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
