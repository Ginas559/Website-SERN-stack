export function buildMonotoneSplinePath(points) {
  const n = Array.isArray(points) ? points.length : 0
  if (n === 0) return ''
  if (n === 1) return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
  if (n === 2) {
    return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)},${points[1].y.toFixed(2)}`
  }

  const dx = new Array(n - 1)
  const dy = new Array(n - 1)
  const slopes = new Array(n - 1)
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1].x - points[i].x
    dy[i] = points[i + 1].y - points[i].y
    slopes[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0
  }

  const tangents = new Array(n)
  tangents[0] = slopes[0]
  tangents[n - 1] = slopes[n - 2]

  for (let i = 1; i < n - 1; i += 1) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0
    } else {
      tangents[i] = (slopes[i - 1] + slopes[i]) / 2
    }
  }

  for (let i = 0; i < n - 1; i += 1) {
    if (slopes[i] === 0) {
      tangents[i] = 0
      tangents[i + 1] = 0
    } else {
      const alpha = tangents[i] / slopes[i]
      const beta = tangents[i + 1] / slopes[i]
      const sqSum = alpha * alpha + beta * beta
      if (sqSum > 9) {
        const tau = 3 / Math.sqrt(sqSum)
        tangents[i] = tau * alpha * slopes[i]
        tangents[i + 1] = tau * beta * slopes[i]
      }
    }
  }

  let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i += 1) {
    const stepX = dx[i] / 3
    const c1x = points[i].x + stepX
    const c1y = points[i].y + tangents[i] * stepX
    const c2x = points[i + 1].x - stepX
    const c2y = points[i + 1].y - tangents[i + 1] * stepX
    path += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${points[i + 1].x.toFixed(2)},${points[i + 1].y.toFixed(2)}`
  }
  return path
}

export function buildMonotoneAreaPath(points, baselineY) {
  const n = Array.isArray(points) ? points.length : 0
  if (n < 2) return ''
  const linePath = buildMonotoneSplinePath(points)
  const firstX = points[0].x.toFixed(2)
  const lastX = points[n - 1].x.toFixed(2)
  const base = Number(baselineY).toFixed(2)
  return `${linePath} L ${lastX},${base} L ${firstX},${base} Z`
}

export function buildCircularSegments(items, radius) {
  const safe = Array.isArray(items) ? items : []
  const circumference = 2 * Math.PI * radius
  const total = safe.reduce((sum, it) => sum + Math.max(0, Number(it.value) || 0), 0)
  return safe.reduce((acc, it) => {
    const val = Math.max(0, Number(it.value) || 0)
    const ratio = total > 0 ? val / total : 0
    const segLen = ratio * circumference
    const offset = acc.length > 0 ? acc[acc.length - 1].endOffset : 0
    acc.push({
      ...it,
      value: val,
      ratio,
      percentage: Number((ratio * 100).toFixed(1)),
      segLen,
      offset,
      endOffset: offset + segLen,
    })
    return acc
  }, [])
}

