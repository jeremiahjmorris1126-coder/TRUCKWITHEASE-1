const money = (n) => `$${n.toFixed(2)}`;

/** Detention invoice as structured data plus a plain-text rendering. */
export function buildDetentionInvoice({ packet, invoiceNumber, billTo, carrier }) {
  const m = packet.metrics;
  const t = packet.timeline;
  const hours = m.detentionMinutes / 60;
  const ratePerHour = m.ratePerHour;

  const lineItem = {
    description: `Detention at ${packet.stop.kind} (load ${packet.stop.loadId}, stop ${packet.stop.stopId})`,
    detentionMinutes: m.detentionMinutes,
    freeMinutes: m.freeMinutes,
    hours: Math.round(hours * 100) / 100,
    ratePerHour,
    amount: m.amount,
  };

  const text = [
    `DETENTION INVOICE ${invoiceNumber}`,
    `Carrier: ${carrier?.name ?? packet.carrier?.name ?? 'N/A'}`,
    `Bill to: ${billTo?.name ?? 'N/A'}`,
    `Load: ${packet.stop.loadId}   Stop: ${packet.stop.stopId} (${packet.stop.kind})`,
    '',
    `Appointment:     ${t.appointment ?? 'n/a'}`,
    `Arrival:         ${t.arrival}`,
    `First door open: ${t.firstDoorOpen ?? 'n/a'}`,
    `Last door close: ${t.lastDoorClose ?? 'n/a'}`,
    `Departure:       ${t.departure ?? 'n/a'}`,
    '',
    `Free time: ${m.freeMinutes} min`,
    `Detention: ${m.detentionMinutes} min @ ${money(ratePerHour)}/hr`,
    ...(m.waitBeforeDoorMinutes != null ? [`Wait before dock work began: ${m.waitBeforeDoorMinutes} min`] : []),
    `AMOUNT DUE: ${money(m.amount)}`,
    '',
    `Evidence packet SHA-256: ${packet.integrity.hash}`,
  ].join('\n');

  return { invoiceNumber, billTo, lineItem, amount: m.amount, evidenceHash: packet.integrity.hash, text };
}
