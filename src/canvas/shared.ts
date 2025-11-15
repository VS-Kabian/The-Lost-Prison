export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number,
  color: string
): void {
  const step = Math.PI / spikes;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(0, -outerRadius);
  for (let i = 0; i < spikes; i++) {
    const angle = i * step * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
    ctx.lineTo(Math.cos(angle + step) * innerRadius, Math.sin(angle + step) * innerRadius);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

