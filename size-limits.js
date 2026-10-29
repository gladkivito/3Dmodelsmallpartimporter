// Same dimension contract as the supplied Atom Script 1: scale, clamp, equally split, round.
export const MIN_STUD = 0.1;
export const MAX_STUD = 2.5;
const r2 = n => Math.max(MIN_STUD, Math.round(n * 100) / 100);
export function axisPieces(total) {
  const size = Math.max(MIN_STUD, total);
  const count = Math.max(1, Math.ceil(size / MAX_STUD - 1e-6));
  return { count, rawSize: size / count, size: r2(size / count), total: size };
}
export function planScaledParts(source, percent = 100) {
  const scale = percent / 100;
  if (!Number.isFinite(scale) || scale <= 0) throw Error('Build scale must be positive.');
  let count = 0, clampedAxes = 0, clampedParts = 0,sourceCount=0;
  for (const part of source) {
    if(part.deleted)continue;sourceCount++;
    let clamped = false, copies = 1;
    for (const dim of part.s) {
      const size = dim * scale;
      if (size < MIN_STUD - 1e-8) { clampedAxes++; clamped = true; }
      copies *= axisPieces(size).count;
    }
    count += copies;
    if (clamped) clampedParts++;
  }
  return { count, sourceCount, extraSplits: count - sourceCount, clampedAxes, clampedParts, scale };
}
export function expandScaledParts(source, percent = 100, limit = 200000) {
  const plan = planScaledParts(source, percent);
  if (plan.count > limit) throw Error(`This scale needs ${plan.count.toLocaleString()} SmallParts. Lower the scale to preview/export it.`);
  const result = [];
  source.forEach((part, sourceIndex) => {
    if(part.deleted)return;
    const axes = part.s.map(n => axisPieces(n * plan.scale));
    for (let x = 0; x < axes[0].count; x++) for (let y = 0; y < axes[1].count; y++) for (let z = 0; z < axes[2].count; z++) {
      const local = [x, y, z].map((index, axis) => -axes[axis].total / 2 + axes[axis].rawSize * (index + .5));
      const position = part.p.map((n, i) => n * plan.scale + local[0] * part.basis[i] + local[1] * part.basis[i + 3] + local[2] * part.basis[i + 6]);
      result.push({ ...part, p: position.map(n => +n.toFixed(6)), s: axes.map(a => a.size), sourceIndex });
    }
  });
  return { ...plan, parts: result };
}
