export const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0))
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '-'
