const BILLABLE_SEAT_STATUSES = new Set(['pending', 'active']);

export const getBillableSeats = (seats = []) =>
  seats.filter((seat) => BILLABLE_SEAT_STATUSES.has(String(seat.status || '').toLowerCase()));

export const getTargetSeatQuantity = (seats = []) => 1 + getBillableSeats(seats).length;

export const chooseBillableSubscription = (subscriptions = [], preferredSubscriptionId = null) => {
  if (preferredSubscriptionId) {
    const preferred = subscriptions.find((subscription) => subscription.id === preferredSubscriptionId);
    if (preferred && ['active', 'trialing'].includes(preferred.status)) return preferred;
  }

  return (
    subscriptions.find((subscription) => ['active', 'trialing'].includes(subscription.status)) ||
    subscriptions.find((subscription) => subscription.status === 'past_due') ||
    null
  );
};

const truncate = (value, maxLength) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};

export const buildSeatBillingDetails = ({ leaderEmail, teamName, seats = [] }) => {
  const billableSeats = getBillableSeats(seats);
  const activeSeats = billableSeats.filter((seat) => String(seat.status || '').toLowerCase() === 'active');
  const pendingSeats = billableSeats.filter((seat) => String(seat.status || '').toLowerCase() === 'pending');
  const seatRefs = billableSeats.map((seat) => seat.email || seat.profile_id || seat.id).filter(Boolean);
  const seatIds = billableSeats.map((seat) => seat.profile_id || seat.id).filter(Boolean);
  const quantity = 1 + billableSeats.length;

  const summary = `${quantity} total (${billableSeats.length} team): ${seatRefs.join(', ') || 'no team seats'}`;
  const descriptionParts = [
    `BYG SMART ${teamName || 'team'} subscription`,
    `Leader: ${leaderEmail || 'unknown'}`,
    `Billable seats: ${seatRefs.join(', ') || 'none'}`,
  ];

  return {
    quantity,
    activeSeatCount: activeSeats.length,
    pendingSeatCount: pendingSeats.length,
    metadata: {
      leader_email: leaderEmail || '',
      team_name: teamName || '',
      billable_seat_count: String(billableSeats.length),
      active_seat_count: String(activeSeats.length),
      pending_seat_count: String(pendingSeats.length),
      seat_emails: truncate(seatRefs.join(','), 500),
      seat_ids: truncate(seatIds.join(','), 500),
    },
    description: truncate(descriptionParts.join(' | '), 500),
    invoiceCustomFields: [
      { name: 'BYG SMART seats', value: truncate(summary, 140) },
    ],
  };
};
